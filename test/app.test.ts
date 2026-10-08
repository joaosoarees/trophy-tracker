import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import nioh from './fixtures/game-achievements-3681010.json';
import {
  checkApiKey,
  checkPrivacy,
  checkSteamId,
} from '../src/main/onboarding';
import { SteamClient } from '../src/main/steam/client';
import { Store } from '../src/main/store';
import { en } from '../src/shared/i18n/locales/en';
import { ptBR } from '../src/shared/i18n/locales/pt-BR';
import { Tracker } from '../src/main/tracker';
import {
  clientWith,
  fakeFetch,
  FORBIDDEN_HTML,
  KEY,
  NO_STATS,
  NOT_PUBLIC,
  STEAM_ID,
  type Route,
} from './helpers';

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'stt-'));
const profile = { steamId: STEAM_ID, name: 'joao', avatar: '' };

const game = (appid: number, name: string, playtime: number, last = 0) => ({
  appid,
  name,
  playtime_forever: playtime,
  img_icon_url: 'abc',
  rtime_last_played: last,
});
const owned = (...games: ReturnType<typeof game>[]): Route => ({
  json: { response: { game_count: games.length, games } },
});
const player = (unlocked: number, total: number): Route => ({
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

describe('onboarding: SteamID', () => {
  it('rejects a bad format without hitting the network', async () => {
    const f = fakeFetch({});
    expect((await checkSteamId(ptBR, '12345', f)).status).toBe('invalid');
    expect(f.calls).toHaveLength(0);
  });

  it('confirms the profile with name and avatar', async () => {
    const f = fakeFetch({
      [`profiles/${STEAM_ID}`]: {
        text: '<profile><steamID64>76561198207154409</steamID64><steamID><![CDATA[João]]></steamID><avatarFull><![CDATA[https://a/b.jpg]]></avatarFull></profile>',
      },
    });
    expect(await checkSteamId(ptBR, ` ${STEAM_ID} `, f)).toEqual({
      status: 'found',
      profile: { steamId: STEAM_ID, name: 'João', avatar: 'https://a/b.jpg' },
    });
  });

  it('blocks only when Steam says the profile does not exist', async () => {
    const f = fakeFetch({
      profiles: {
        text: '<response><error><![CDATA[The specified profile could not be found.]]></error></response>',
      },
    });
    expect((await checkSteamId(ptBR, STEAM_ID, f)).status).toBe('not-found');
  });

  it.each([
    [
      'rate limit',
      { status: 429, text: '<html>Too Many Requests</html>' },
      'a Steam respondeu com erro 429',
    ],
    [
      'a page that is not the profile',
      { text: '<html><body>Steam Community :: Error</body></html>' },
      'a Steam devolveu uma resposta inesperada',
    ],
    [
      'another Steam error',
      {
        text: '<response><error><![CDATA[Please try again later.]]></error></response>',
      },
      'a Steam respondeu: Please try again later.',
    ],
  ])(
    'lets the user move on when it cannot confirm: %s',
    async (_caso, route, reason) => {
      expect(
        await checkSteamId(ptBR, STEAM_ID, fakeFetch({ profiles: route })),
      ).toEqual({ status: 'unconfirmed', steamId: STEAM_ID, reason });
    },
  );

  it('lets the user move on when the network fails', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect(await checkSteamId(ptBR, STEAM_ID, offline)).toMatchObject({
      status: 'unconfirmed',
      reason: 'não foi possível falar com a Steam',
    });
  });
});

describe('onboarding: key', () => {
  it('rejects a bad format', async () => {
    expect(
      (await checkApiKey(ptBR, clientWith({}), STEAM_ID, 'short')).ok,
    ).toBe(false);
  });

  it('rejects a key Steam does not accept', async () => {
    const r = await checkApiKey(
      ptBR,
      clientWith({ GetPlayerSummaries: FORBIDDEN_HTML }),
      STEAM_ID,
      KEY,
    );
    expect(r).toEqual({
      ok: false,
      error: 'A Steam recusou a chave da Web API.',
    });
  });

  it('answers in the requested language', async () => {
    const r = await checkApiKey(
      en,
      clientWith({ GetPlayerSummaries: FORBIDDEN_HTML }),
      STEAM_ID,
      KEY,
    );
    expect(r).toEqual({ ok: false, error: 'Steam rejected the Web API key.' });
    expect(await checkSteamId(en, '12345')).toEqual({
      status: 'invalid',
      error: 'A SteamID has 17 digits and starts with 7656119.',
    });
  });

  it('accepts a valid key', async () => {
    const client = clientWith({
      GetPlayerSummaries: {
        json: {
          response: {
            players: [
              { steamid: STEAM_ID, personaname: 'joao', avatarfull: 'x' },
            ],
          },
        },
      },
    });
    expect((await checkApiKey(ptBR, client, STEAM_ID, KEY)).ok).toBe(true);
  });
});

describe('onboarding: privacy', () => {
  it('rejects when the library is not visible', async () => {
    expect(
      (
        await checkPrivacy(
          ptBR,
          clientWith({ GetOwnedGames: { json: { response: {} } } }),
          STEAM_ID,
          KEY,
        )
      ).ok,
    ).toBe(false);
  });

  it('rejects when the achievements are not visible', async () => {
    const client = clientWith({
      GetOwnedGames: owned(game(1, 'A', 10)),
      GetPlayerAchievements: NOT_PUBLIC,
    });
    expect((await checkPrivacy(ptBR, client, STEAM_ID, KEY)).ok).toBe(false);
  });

  it('skips games with no achievements and counts the played ones', async () => {
    const client = clientWith({
      GetOwnedGames: owned(
        game(1, 'No achievements', 10, 200),
        game(2, 'With', 10, 100),
        game(3, 'Never opened', 0),
      ),
      'appid=1': NO_STATS,
      'appid=2': player(1, 2),
    });
    expect(await checkPrivacy(ptBR, client, STEAM_ID, KEY)).toEqual({
      ok: true,
      value: { gamesWithPlaytime: 2 },
    });
  });
});

describe('Store', () => {
  it('stores the key in a user-only file and reads it back', () => {
    const dir = tempDir();
    new Store(dir).setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile);
    expect(statSync(join(dir, 'config.json')).mode & 0o777).toBe(0o600);
    const again = new Store(dir);
    expect(again.getCredentials()).toEqual({ steamId: STEAM_ID, apiKey: KEY });
    expect(again.getProfile()).toEqual(profile);
  });

  it('encrypts the key when a cipher is available', () => {
    const dir = tempDir();
    const cipher = {
      encrypt: (s: string) => `enc:${s}`,
      decrypt: (s: string) => s.slice(4),
    };
    new Store(dir, cipher).setCredentials(
      { steamId: STEAM_ID, apiKey: KEY },
      profile,
    );
    expect(new Store(dir).getCredentials()).toBeNull();
    expect(new Store(dir, cipher).getCredentials()?.apiKey).toBe(KEY);
  });

  it('starts in English, remembers the language and drops the translated cache on change', () => {
    const dir = tempDir();
    const store = new Store(dir);
    expect(store.getLanguage()).toBe('en');
    store.setSchema(1, []);
    store.setSummaries({ 1: { total: 4, unlocked: 1, playtime: 10 } });
    store.setLanguage('pt-BR');
    const again = new Store(dir);
    expect(again.getLanguage()).toBe('pt-BR');
    expect(again.getSchema(1)).toBeNull();
    expect(again.getSummary(1)).toEqual({
      total: 4,
      unlocked: 1,
      playtime: 10,
    });
  });

  it('drops a cache written in another language on startup (e.g. from an earlier, Portuguese-only version)', () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, 'cache.json'),
      JSON.stringify({
        games: {},
        summaries: {},
        art: {},
        schemas: { 1: { fetchedAt: 1, items: [] } },
      }),
    );
    expect(new Store(dir).getSchema(1)).toBeNull();

    const store = new Store(dir);
    store.setSchema(2, []);
    expect(new Store(dir).getSchema(2)).toEqual({
      fetchedAt: expect.any(Number),
      items: [],
    });
  });

  it('persists notes and pins, and removes empty entries', () => {
    const dir = tempDir();
    const store = new Store(dir);
    store.setUserData(10, 'A', { note: 'boss of the 3rd map', pinned: true });
    store.setUserData(10, 'B', { note: '', pinned: true });
    store.setUserData(10, 'B', { note: ' ', pinned: false });
    expect(new Store(dir).getUserData(10)).toEqual({
      A: { note: 'boss of the 3rd map', pinned: true },
    });
  });

  it('keeps the entry while there is a checklist and remembers always-on-top', () => {
    const dir = tempDir();
    const store = new Store(dir);
    const checklist = [{ id: '1', text: 'Bridge Kodama', done: true }];
    store.setUserData(10, 'A', { note: '', pinned: false, checklist });
    store.setAlwaysOnTop(true);
    const again = new Store(dir);
    expect(again.getUserData(10)).toEqual({
      A: { note: '', pinned: false, checklist },
    });
    expect(again.getAlwaysOnTop()).toBe(true);
    again.setUserData(10, 'A', { note: '', pinned: false, checklist: [] });
    expect(new Store(dir).getUserData(10)).toEqual({});
  });
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
