import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { Tracker } from '@main/services/Tracker';
import { SteamClient } from '@main/steam/client';
import { Store } from '@main/storage/Store';
import nioh from '@test/fixtures/game-achievements-3681010.json';
import {
  fakeFetch,
  FORBIDDEN_HTML,
  KEY,
  NO_STATS,
  NOT_PUBLIC,
  STEAM_ID,
  type IRoute,
} from '@test/helpers';

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'stt-'));
const profile = { steamId: STEAM_ID, name: 'joao', avatar: '' };

const game = (appid: number, name: string, playtime: number, last = 0) => ({
  appid,
  name,
  playtime_forever: playtime,
  img_icon_url: 'abc',
  rtime_last_played: last,
});
const owned = (...games: ReturnType<typeof game>[]): IRoute => ({
  json: { response: { game_count: games.length, games } },
});
const player = (unlocked: number, total: number): IRoute => ({
  json: {
    playerstats: {
      success: true,
      achievements: Array.from({ length: total }, (_, i) => ({
        apiname: `A${i}`,
        achieved: i < unlocked ? 1 : 0,
        unlocktime: 0,
      })),
    },
  },
});

describe('Tracker', () => {
  const setup = (
    routes: Parameters<typeof fakeFetch>[0],
    statMap = new Map<string, string>(),
  ) => {
    const store = new Store(tempDir());
    store.setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile);
    const fetchImpl = fakeFetch(routes);
    let now = 1_000_000;
    const tracker = new Tracker({
      store,
      client: new SteamClient(fetchImpl),
      readStatMap: async () => statMap,
      now: () => now,
    });
    return { tracker, store, fetchImpl, advance: (ms: number) => (now += ms) };
  };

  it('builds the game view with counters taken from the stats', async () => {
    const { tracker } = setup(
      {
        GetOwnedGames: owned(game(3681010, 'Nioh 3', 500)),
        GetGameAchievements: { json: nioh },
        GetPlayerAchievements: {
          json: {
            playerstats: {
              achievements: [
                { apiname: 'ACH_002', achieved: 1, unlocktime: 9 },
              ],
            },
          },
        },
        GetUserStatsForGame: {
          json: {
            playerstats: { stats: [{ name: 'ACH_001_PROGRESS', value: 12 }] },
          },
        },
      },
      new Map([['ACH_001', 'ACH_001_PROGRESS']]),
    );
    const view = await tracker.getGame(3681010);
    expect(view.name).toBe('Nioh 3');
    expect(view.unlockedCount).toBe(1);
    expect(view.achievements.find((a) => a.id === 'ACH_001')?.progress).toEqual(
      { current: 12, target: 39 },
    );
  });

  it('keeps the list when the counters fail', async () => {
    const { tracker } = setup(
      {
        GetOwnedGames: owned(game(3681010, 'Nioh 3', 500)),
        GetGameAchievements: { json: nioh },
        GetPlayerAchievements: { json: { playerstats: { achievements: [] } } },
        GetUserStatsForGame: { status: 500, text: 'error' },
      },
      new Map([['ACH_001', 'ACH_001_PROGRESS']]),
    );
    const view = await tracker.getGame(3681010);
    expect(view.total).toBe(64);
    expect(
      view.achievements.find((a) => a.id === 'ACH_001')?.progress,
    ).toBeNull();
  });

  it('uses the cache for a minute and re-reads when forced', async () => {
    const { tracker, fetchImpl, advance } = setup({
      GetOwnedGames: owned(game(7, 'Game', 5)),
      GetGameAchievements: { json: { response: { achievements: [] } } },
      GetPlayerAchievements: player(0, 0),
    });
    const count = () =>
      fetchImpl.calls.filter((u) => u.includes('GetPlayerAchievements')).length;
    await tracker.getGame(7);
    await tracker.getGame(7);
    expect(count()).toBe(1);
    await tracker.getGame(7, true);
    expect(count()).toBe(2);
    advance(61_000);
    await tracker.getGame(7);
    expect(count()).toBe(3);
  });

  it('on the periodic check re-reads only the player state and returns the same object if nothing changed', async () => {
    let unlocked = 1;
    const { tracker, fetchImpl, advance } = setup({
      GetOwnedGames: owned(game(3681010, 'Nioh 3', 500)),
      GetGameAchievements: { json: nioh },
      GetPlayerAchievements: () => ({
        json: {
          playerstats: {
            achievements: nioh.response.achievements
              .slice(0, unlocked)
              .map((a) => ({
                apiname: a.internal_name,
                achieved: 1,
                unlocktime: 9,
              })),
          },
        },
      }),
    });
    const count = (name: string) =>
      fetchImpl.calls.filter((u) => u.includes(name)).length;
    const first = await tracker.getGame(3681010);
    advance(60_000);
    const second = await tracker.getGame(3681010, 'poll');
    expect(second).toBe(first);
    expect(count('GetGameAchievements')).toBe(1);
    expect(count('GetPlayerAchievements')).toBe(2);

    unlocked = 2;
    advance(60_000);
    const third = await tracker.getGame(3681010, 'poll');
    expect(third).not.toBe(first);
    expect(third.unlockedCount).toBe(2);
    expect(third.achievements[5]).toBe(first.achievements[5]);
    expect(count('GetGameAchievements')).toBe(1);

    await tracker.getGame(3681010, true);
    expect(count('GetGameAchievements')).toBe(2);
  });

  it('merges identical simultaneous requests into a single read', async () => {
    const { tracker, fetchImpl } = setup({
      GetOwnedGames: owned(game(1, 'A', 10), game(2, 'B', 10)),
      GetGameAchievements: { json: { response: { achievements: [] } } },
      GetPlayerAchievements: player(1, 4),
    });
    const count = (name: string) =>
      fetchImpl.calls.filter((u) => u.includes(name)).length;
    const [a, b] = await Promise.all([tracker.getGame(1), tracker.getGame(1)]);
    expect(a).toBe(b);
    expect(count('GetPlayerAchievements')).toBe(1);
    expect(count('GetOwnedGames')).toBe(1);
    await Promise.all([tracker.getDashboard(), tracker.getDashboard()]);
    expect(count('GetPlayerAchievements')).toBe(1 + 1);
  });

  it('answers with the last known game at once and refreshes it behind the scenes', async () => {
    let unlocked = 1;
    const { tracker, fetchImpl, advance } = setup({
      GetOwnedGames: owned(game(3681010, 'Nioh 3', 500)),
      GetGameAchievements: { json: nioh },
      GetPlayerAchievements: () => ({
        json: {
          playerstats: {
            achievements: nioh.response.achievements
              .slice(0, unlocked)
              .map((a) => ({
                apiname: a.internal_name,
                achieved: 1,
                unlocktime: 9,
              })),
          },
        },
      }),
    });
    const reads = () =>
      fetchImpl.calls.filter((u) => u.includes('GetPlayerAchievements')).length;
    const onFresh = vi.fn();
    const onError = vi.fn();

    // Nothing cached yet: a normal read.
    const first = await tracker.getGameStaleFirst(3681010, {
      onFresh,
      onError,
    });
    expect(reads()).toBe(1);

    // Cached and recent: no read at all.
    expect(await tracker.getGameStaleFirst(3681010, { onFresh, onError })).toBe(
      first,
    );
    expect(reads()).toBe(1);

    // Stale and unchanged: answers with the cache, refreshes, announces nothing.
    advance(5 * 60_000);
    expect(await tracker.getGameStaleFirst(3681010, { onFresh, onError })).toBe(
      first,
    );
    await vi.waitFor(() => expect(reads()).toBe(2));
    // Joins the refresh still in flight, so the next step starts from a settled cache.
    await tracker.getGame(3681010);
    expect(onFresh).not.toHaveBeenCalled();

    // Stale and changed: still answers with the cache, then hands over the new view.
    unlocked = 3;
    advance(5 * 60_000);
    const stale = await tracker.getGameStaleFirst(3681010, {
      onFresh,
      onError,
    });
    expect(stale.unlockedCount).toBe(1);
    await vi.waitFor(() => expect(onFresh).toHaveBeenCalledTimes(1));
    expect(onFresh.mock.calls[0][0]).toMatchObject({ unlockedCount: 3 });
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a failed background refresh without failing the answer', async () => {
    let broken = false;
    const { tracker, advance } = setup({
      GetOwnedGames: owned(game(7, 'Game', 5)),
      GetGameAchievements: { json: { response: { achievements: [] } } },
      GetPlayerAchievements: () => (broken ? FORBIDDEN_HTML : player(0, 0)),
    });
    const onFresh = vi.fn();
    const onError = vi.fn();
    const first = await tracker.getGameStaleFirst(7, { onFresh, onError });

    broken = true;
    advance(5 * 60_000);
    expect(await tracker.getGameStaleFirst(7, { onFresh, onError })).toBe(
      first,
    );
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toMatchObject({ kind: 'invalid-key' });
    expect(onFresh).not.toHaveBeenCalled();
  });

  it('picks the last played game when no game is open', async () => {
    const { tracker } = setup({
      GetOwnedGames: owned(
        game(1, 'Old', 10, 100),
        game(2, 'Recent', 10, 900),
        game(3, 'Never', 0, 0),
      ),
    });
    expect(await tracker.lastPlayedAppId()).toBe(2);
  });

  it('sorts the dashboard by closest to 100%, complete ones last, only played games with achievements', async () => {
    const { tracker } = setup({
      GetOwnedGames: owned(
        game(1, 'Half', 10),
        game(2, 'Complete', 10),
        game(3, 'Almost', 10),
        game(4, 'No achievements', 10),
        game(5, 'Never opened', 0),
      ),
      'appid=1': player(5, 10),
      'appid=2': player(10, 10),
      'appid=3': player(9, 10),
      'appid=4': NO_STATS,
    });
    const progress: number[] = [];
    const list = await tracker.getDashboard('cached', (done) =>
      progress.push(done),
    );
    expect(list.map((g) => g.name)).toEqual(['Almost', 'Half', 'Complete']);
    expect(list[0]).toMatchObject({ unlocked: 9, total: 10 });
    expect(progress.sort()).toEqual([1, 2, 3, 4]);
  });

  it('on the dashboard, re-reads only games whose playtime changed', async () => {
    let playtime = 10;
    const { tracker, fetchImpl, advance } = setup({
      GetOwnedGames: () => owned(game(1, 'A', playtime), game(2, 'B', 20)),
      GetPlayerAchievements: player(1, 4),
    });
    const count = () =>
      fetchImpl.calls.filter((u) => u.includes('GetPlayerAchievements')).length;
    await tracker.getDashboard();
    expect(count()).toBe(2);
    advance(11 * 60_000);
    await tracker.getDashboard();
    expect(count()).toBe(2);
    playtime = 15;
    advance(11 * 60_000);
    await tracker.getDashboard();
    expect(count()).toBe(3);
    await tracker.getDashboard('all');
    expect(count()).toBe(5);
  });

  it('attaches the store art and does not ask again for what it already knows', async () => {
    const { tracker, fetchImpl } = setup({
      GetOwnedGames: owned(game(1, 'A', 10), game(2, 'B', 10)),
      GetPlayerAchievements: player(1, 4),
      GetGameAchievements: { json: { response: { achievements: [] } } },
      GetItems: (url) => {
        const ids = JSON.parse(url.searchParams.get('input_json')!).ids.map(
          (i: { appid: number }) => i.appid,
        );
        return {
          json: {
            response: {
              store_items: ids
                .filter((appid: number) => appid === 1)
                .map((appid: number) => ({
                  appid,
                  assets: {
                    asset_url_format: 'steam/apps/1/${FILENAME}?t=9',
                    header: 'abc/header.jpg',
                    small_capsule: 'def/capsule_231x87.jpg',
                  },
                })),
            },
          },
        };
      },
    });
    const list = await tracker.getDashboard();
    expect(list.find((g) => g.appid === 1)?.capsule).toBe(
      'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/def/capsule_231x87.jpg?t=9',
    );
    expect(list.find((g) => g.appid === 2)?.capsule).toBe('');
    expect((await tracker.getGame(1)).header).toContain('/abc/header.jpg');
    await tracker.getDashboard('all');
    expect(fetchImpl.calls.filter((u) => u.includes('GetItems'))).toHaveLength(
      1,
    );
  });

  it('shows the game even when the store fails to provide the art', async () => {
    const { tracker } = setup({
      GetOwnedGames: owned(game(1, 'A', 10)),
      GetPlayerAchievements: player(1, 4),
      GetGameAchievements: { json: { response: { achievements: [] } } },
      GetItems: { status: 500, text: 'error' },
    });
    expect(await tracker.getDashboard()).toHaveLength(1);
    expect((await tracker.getGame(1)).header).toBe('');
  });

  it('reports when a complete game was completed, and reads once more the entries saved without it', async () => {
    const complete = {
      json: {
        playerstats: {
          achievements: [
            { apiname: 'A', achieved: 1, unlocktime: 500 },
            { apiname: 'B', achieved: 1, unlocktime: 900 },
          ],
        },
      },
    };
    const { tracker, store, fetchImpl, advance } = setup({
      GetOwnedGames: owned(game(1, 'Done', 10), game(2, 'Ongoing', 10)),
      'appid=1': complete,
      'appid=2': player(1, 4),
    });
    const reads = () =>
      fetchImpl.calls.filter((u) => u.includes('GetPlayerAchievements')).length;

    const list = await tracker.getDashboard();
    expect(list.find((g) => g.appid === 1)?.completedAt).toBe(900);
    expect(list.find((g) => g.appid === 2)?.completedAt).toBeNull();
    expect(reads()).toBe(2);

    // An entry written before the completion date existed.
    store.setSummaries({ 1: { total: 2, unlocked: 2, playtime: 10 } });
    advance(11 * 60_000);
    expect(
      (await tracker.getDashboard()).find((g) => g.appid === 1)?.completedAt,
    ).toBe(900);
    expect(reads()).toBe(3);

    advance(11 * 60_000);
    await tracker.getDashboard();
    expect(reads()).toBe(3);
  });

  it('propagates a private profile instead of showing an empty dashboard', async () => {
    const { tracker } = setup({
      GetOwnedGames: owned(game(1, 'A', 10)),
      GetPlayerAchievements: NOT_PUBLIC,
    });
    await expect(tracker.getDashboard()).rejects.toMatchObject({
      kind: 'private',
    });
  });
});
