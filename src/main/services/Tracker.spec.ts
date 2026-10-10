import { describe, expect, it, vi } from 'vitest';

import { type IGameView } from '@shared/types/Game';
import { makeGameSummary } from '@tests/factories/makeGameSummary';
import nioh from '@tests/fixtures/game-achievements-3681010.json';
import {
  fakeFetch,
  FORBIDDEN_HTML,
  type IRoute,
  KEY,
  makeDiskStore,
  NO_STATS,
  NOT_PUBLIC,
  STEAM_ID,
} from '@tests/helpers';
import { game, owned, player } from '@tests/steamLibrary';

import { SteamClient } from '../steam/SteamClient';

import { Tracker } from './Tracker';

const NIOH = 3681010;
const profile = { steamId: STEAM_ID, name: 'player', avatar: '' };

/** A game whose achievement list is empty. */
const NO_ACHIEVEMENT_LIST: IRoute = {
  json: { response: { achievements: [] } },
};
const STORE_DOWN: IRoute = { status: 500, text: 'error' };

/** What the player has in Nioh 3: the first `count` achievements of the list. */
const niohUnlocked = (count: number): IRoute => ({
  json: {
    playerstats: {
      achievements: nioh.response.achievements.slice(0, count).map((a) => ({
        apiname: a.internal_name,
        achieved: 1,
        unlocktime: 9,
      })),
    },
  },
});

/** The store, which only has art for the game 1. */
const storeArtOfGame1 = (url: URL): IRoute => {
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
};

/** How many requests were made to the Steam method `name`. */
const requestsTo = (fetchImpl: { calls: string[] }, name: string): number =>
  fetchImpl.calls.filter((url) => url.includes(name)).length;

/** For a test that is not about what the refresh behind the scenes says. */
const unheard = {
  onFresh: (): void => undefined,
  onError: (): void => undefined,
};

function setup(
  routes: Parameters<typeof fakeFetch>[0],
  statMap = new Map<string, string>(),
) {
  const store = makeDiskStore();
  store.setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile);
  const fetchImpl = fakeFetch(routes);
  let now = 1_000_000;
  const sut = new Tracker({
    store,
    client: new SteamClient(fetchImpl),
    readStatMap: () => Promise.resolve(statMap),
    now: () => now,
  });
  const advance = (ms: number): void => {
    now += ms;
  };
  return { sut, fetchImpl, advance };
}

/** A library with the game 7, which has no achievements. */
const setupGame7 = () =>
  setup({
    GetOwnedGames: owned(game(7, 'Game', 5)),
    GetGameAchievements: NO_ACHIEVEMENT_LIST,
    GetPlayerAchievements: player(0, 0),
  });

/**
 * A library with Nioh 3 and one achievement unlocked. `unlock` changes how
 * many of them Steam says are unlocked from then on.
 */
function setupNioh() {
  let unlocked = 1;
  const made = setup({
    GetOwnedGames: owned(game(NIOH, 'Nioh 3', 500)),
    GetGameAchievements: { json: nioh },
    GetPlayerAchievements: () => niohUnlocked(unlocked),
  });
  const unlock = (count: number): void => {
    unlocked = count;
  };
  return { ...made, unlock };
}

/** A library with the games 1 and 2, the first with `playtime` minutes. */
function setupTwoGames() {
  let playtime = 10;
  const made = setup({
    GetOwnedGames: () => owned(game(1, 'A', playtime), game(2, 'B', 20)),
    GetPlayerAchievements: player(1, 4),
  });
  const play = (minutes: number): void => {
    playtime = minutes;
  };
  return { ...made, play };
}

/** A library with a complete game, 1, and one still in progress, 2. */
const setupCompleteGame = () =>
  setup({
    GetOwnedGames: owned(game(1, 'Done', 10), game(2, 'Ongoing', 10)),
    'appid=1': {
      json: {
        playerstats: {
          achievements: [
            { apiname: 'A', achieved: 1, unlocktime: 500 },
            { apiname: 'B', achieved: 1, unlocktime: 900 },
          ],
        },
      },
    },
    'appid=2': player(1, 4),
  });

describe('Tracker', () => {
  describe('getGame', () => {
    it('should build the game view with counters taken from the stats', async () => {
      const { sut } = setup(
        {
          GetOwnedGames: owned(game(NIOH, 'Nioh 3', 500)),
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
              playerstats: {
                stats: [{ name: 'ACH_001_PROGRESS', value: 12 }],
              },
            },
          },
        },
        new Map([['ACH_001', 'ACH_001_PROGRESS']]),
      );

      const view = await sut.getGame(NIOH);

      expect(view.name).toBe('Nioh 3');
      expect(view.unlockedCount).toBe(1);
      expect(
        view.achievements.find((a) => a.id === 'ACH_001')?.progress,
      ).toEqual({ current: 12, target: 39 });
    });

    it('should keep the list when the counters fail', async () => {
      const { sut } = setup(
        {
          GetOwnedGames: owned(game(NIOH, 'Nioh 3', 500)),
          GetGameAchievements: { json: nioh },
          GetPlayerAchievements: {
            json: { playerstats: { achievements: [] } },
          },
          GetUserStatsForGame: { status: 500, text: 'error' },
        },
        new Map([['ACH_001', 'ACH_001_PROGRESS']]),
      );

      const view = await sut.getGame(NIOH);

      expect(view.total).toBe(64);
      expect(
        view.achievements.find((a) => a.id === 'ACH_001')?.progress,
      ).toBeNull();
    });

    it('should answer from the cache when the game was read under a minute ago', async () => {
      const { sut, fetchImpl } = setupGame7();
      await sut.getGame(7);

      await sut.getGame(7);

      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(1);
    });

    it('should read the game again when the cache is over a minute old', async () => {
      const { sut, fetchImpl, advance } = setupGame7();
      await sut.getGame(7);
      advance(61_000);

      await sut.getGame(7);

      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(2);
    });

    it('should read the player state again when forced', async () => {
      const { sut, fetchImpl } = setupGame7();
      await sut.getGame(7);

      await sut.getGame(7, true);

      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(2);
    });

    it('should read the achievement list again when forced', async () => {
      const { sut, fetchImpl } = setupNioh();
      await sut.getGame(NIOH);

      await sut.getGame(NIOH, true);

      expect(requestsTo(fetchImpl, 'GetGameAchievements')).toBe(2);
    });

    it('should answer the same object when the periodic check finds nothing new', async () => {
      const { sut, advance } = setupNioh();
      const first = await sut.getGame(NIOH);
      advance(60_000);

      const second = await sut.getGame(NIOH, 'poll');

      expect(second).toBe(first);
    });

    it('should read only the player state on the periodic check', async () => {
      const { sut, fetchImpl, advance } = setupNioh();
      await sut.getGame(NIOH);
      advance(60_000);

      await sut.getGame(NIOH, 'poll');

      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(2);
      expect(requestsTo(fetchImpl, 'GetGameAchievements')).toBe(1);
    });

    it('should answer a new object that keeps the unchanged achievements when one was unlocked', async () => {
      const { sut, advance, unlock } = setupNioh();
      const first = await sut.getGame(NIOH);
      unlock(2);
      advance(60_000);

      const second = await sut.getGame(NIOH, 'poll');

      expect(second).not.toBe(first);
      expect(second.unlockedCount).toBe(2);
      expect(second.achievements[5]).toBe(first.achievements[5]);
    });

    it('should share one read between identical simultaneous requests', async () => {
      const { sut, fetchImpl } = setup({
        GetOwnedGames: owned(game(1, 'A', 10), game(2, 'B', 10)),
        GetGameAchievements: NO_ACHIEVEMENT_LIST,
        GetPlayerAchievements: player(1, 4),
      });

      const [a, b] = await Promise.all([sut.getGame(1), sut.getGame(1)]);

      expect(a).toBe(b);
      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(1);
      expect(requestsTo(fetchImpl, 'GetOwnedGames')).toBe(1);
    });

    it('should attach the header the store has for the game', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(game(1, 'A', 10)),
        GetGameAchievements: NO_ACHIEVEMENT_LIST,
        GetPlayerAchievements: player(1, 4),
        GetItems: storeArtOfGame1,
      });

      const view = await sut.getGame(1);

      expect(view.header).toBe(
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/abc/header.jpg?t=9',
      );
    });

    it('should leave the header empty when the store fails to provide the art', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(game(1, 'A', 10)),
        GetGameAchievements: NO_ACHIEVEMENT_LIST,
        GetPlayerAchievements: player(1, 4),
        GetItems: STORE_DOWN,
      });

      const view = await sut.getGame(1);

      expect(view.header).toBe('');
    });
  });

  describe('getGameStaleFirst', () => {
    it('should read the game when nothing is cached', async () => {
      const { sut, fetchImpl } = setupNioh();

      const view = await sut.getGameStaleFirst(NIOH, unheard);

      expect(view.unlockedCount).toBe(1);
      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(1);
    });

    it('should answer the cached game without reading when it is recent', async () => {
      const { sut, fetchImpl } = setupNioh();
      const first = await sut.getGameStaleFirst(NIOH, unheard);

      const second = await sut.getGameStaleFirst(NIOH, unheard);

      expect(second).toBe(first);
      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(1);
    });

    it('should announce nothing when the refresh of a stale game finds no change', async () => {
      const { sut, fetchImpl, advance } = setupNioh();
      const onFreshMock = vi.fn<(view: IGameView) => void>();
      const callbacks = { ...unheard, onFresh: onFreshMock };
      const first = await sut.getGameStaleFirst(NIOH, callbacks);
      advance(5 * 60_000);

      const stale = await sut.getGameStaleFirst(NIOH, callbacks);
      await vi.waitFor(() =>
        expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(2),
      );
      // Joins the refresh still in flight, so what follows sees how it ended.
      await sut.getGame(NIOH);

      expect(stale).toBe(first);
      expect(onFreshMock).not.toHaveBeenCalled();
    });

    it('should answer the stale game at once and hand over the new view when it changed', async () => {
      const { sut, advance, unlock } = setupNioh();
      const onFreshMock = vi.fn<(view: IGameView) => void>();
      const onErrorMock = vi.fn<(e: unknown) => void>();
      const callbacks = { onFresh: onFreshMock, onError: onErrorMock };
      await sut.getGameStaleFirst(NIOH, callbacks);
      unlock(3);
      advance(5 * 60_000);

      const stale = await sut.getGameStaleFirst(NIOH, callbacks);

      expect(stale.unlockedCount).toBe(1);
      await vi.waitFor(() =>
        expect(onFreshMock).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ unlockedCount: 3 }),
        ),
      );
      expect(onErrorMock).not.toHaveBeenCalled();
    });

    it('should report a failed refresh without failing the answer', async () => {
      let isBroken = false;
      const { sut, advance } = setup({
        GetOwnedGames: owned(game(7, 'Game', 5)),
        GetGameAchievements: NO_ACHIEVEMENT_LIST,
        GetPlayerAchievements: () => (isBroken ? FORBIDDEN_HTML : player(0, 0)),
      });
      const onFreshMock = vi.fn<(view: IGameView) => void>();
      const onErrorMock = vi.fn<(e: unknown) => void>();
      const callbacks = { onFresh: onFreshMock, onError: onErrorMock };
      const first = await sut.getGameStaleFirst(7, callbacks);
      isBroken = true;
      advance(5 * 60_000);

      const stale = await sut.getGameStaleFirst(7, callbacks);

      expect(stale).toBe(first);
      await vi.waitFor(() =>
        expect(onErrorMock).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ kind: 'invalid-key' }),
        ),
      );
      expect(onFreshMock).not.toHaveBeenCalled();
    });
  });

  describe('lastPlayedAppId', () => {
    it('should pick the game played most recently', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(
          game(1, 'Old', 10, 100),
          game(2, 'Recent', 10, 900),
          game(3, 'Never', 0, 0),
        ),
      });

      const appId = await sut.lastPlayedAppId();

      expect(appId).toBe(2);
    });
  });

  describe('getDashboard', () => {
    it('should list the games from the closest to complete to the furthest, complete ones last', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(
          game(1, 'Half', 10),
          game(2, 'Complete', 10),
          game(3, 'Almost', 10),
        ),
        'appid=1': player(5, 10),
        'appid=2': player(10, 10),
        'appid=3': player(9, 10),
      });

      const list = await sut.getDashboard();

      expect(list.map((g) => g.name)).toEqual(['Almost', 'Half', 'Complete']);
    });

    it('should leave out games never played and games without achievements', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(
          game(1, 'Half', 10),
          game(4, 'No achievements', 10),
          game(5, 'Never opened', 0),
        ),
        'appid=1': player(5, 10),
        'appid=4': NO_STATS,
      });

      const list = await sut.getDashboard();

      expect(list.map((g) => g.name)).toEqual(['Half']);
    });

    it('should describe a game as the dashboard lists it', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(game(3, 'Almost', 10)),
        GetPlayerAchievements: player(9, 10),
      });

      const list = await sut.getDashboard();

      expect(list).toEqual([
        makeGameSummary({
          appid: 3,
          name: 'Almost',
          icon: 'https://media.steampowered.com/steamcommunity/public/images/apps/3/abc.jpg',
          unlocked: 9,
        }),
      ]);
    });

    it('should report each played game read, out of how many', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(
          game(1, 'Half', 10),
          game(2, 'Complete', 10),
          game(4, 'No achievements', 10),
          game(5, 'Never opened', 0),
        ),
        'appid=1': player(5, 10),
        'appid=2': player(10, 10),
        'appid=4': NO_STATS,
      });
      const progress: [done: number, total: number][] = [];

      await sut.getDashboard('cached', (done, total) => {
        progress.push([done, total]);
      });

      expect(progress).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
    });

    it('should share one read between identical simultaneous requests', async () => {
      const { sut, fetchImpl } = setupTwoGames();

      await Promise.all([sut.getDashboard(), sut.getDashboard()]);

      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(2);
    });

    it('should read every played game the first time', async () => {
      const { sut, fetchImpl } = setupTwoGames();

      await sut.getDashboard();

      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(2);
    });

    it('should not read again a game whose playtime did not change', async () => {
      const { sut, fetchImpl, advance } = setupTwoGames();
      await sut.getDashboard();
      advance(11 * 60_000);

      await sut.getDashboard();

      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(2);
    });

    it('should read again only the game whose playtime changed', async () => {
      const { sut, fetchImpl, advance, play } = setupTwoGames();
      await sut.getDashboard();
      play(15);
      advance(11 * 60_000);

      await sut.getDashboard();

      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(3);
    });

    it('should read every game again when asked for all of them', async () => {
      const { sut, fetchImpl } = setupTwoGames();
      await sut.getDashboard();

      await sut.getDashboard('all');

      expect(requestsTo(fetchImpl, 'GetPlayerAchievements')).toBe(4);
    });

    it('should attach the capsule the store has for a game', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(game(1, 'A', 10), game(2, 'B', 10)),
        GetPlayerAchievements: player(1, 4),
        GetItems: storeArtOfGame1,
      });

      const list = await sut.getDashboard();

      expect(list.find((g) => g.appid === 1)?.capsule).toBe(
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/def/capsule_231x87.jpg?t=9',
      );
    });

    it('should leave the capsule empty for a game the store has no art for', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(game(1, 'A', 10), game(2, 'B', 10)),
        GetPlayerAchievements: player(1, 4),
        GetItems: storeArtOfGame1,
      });

      const list = await sut.getDashboard();

      expect(list.find((g) => g.appid === 2)?.capsule).toBe('');
    });

    it('should not ask the store again about art it already asked for', async () => {
      const { sut, fetchImpl } = setup({
        GetOwnedGames: owned(game(1, 'A', 10), game(2, 'B', 10)),
        GetPlayerAchievements: player(1, 4),
        GetItems: storeArtOfGame1,
      });
      await sut.getDashboard();

      await sut.getDashboard('all');

      expect(requestsTo(fetchImpl, 'GetItems')).toBe(1);
    });

    it('should list the game when the store fails to provide the art', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(game(1, 'A', 10)),
        GetPlayerAchievements: player(1, 4),
        GetItems: STORE_DOWN,
      });

      const list = await sut.getDashboard();

      expect(list.map((g) => g.name)).toEqual(['A']);
    });

    it('should say when a complete game was completed', async () => {
      const { sut } = setupCompleteGame();

      const list = await sut.getDashboard();

      expect(list.find((g) => g.appid === 1)?.completedAt).toBe(900);
    });

    it('should give no completion date to a game still in progress', async () => {
      const { sut } = setupCompleteGame();

      const list = await sut.getDashboard();

      expect(list.find((g) => g.appid === 2)?.completedAt).toBeNull();
    });

    it('should fail with a private profile instead of answering an empty dashboard', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(game(1, 'A', 10)),
        GetPlayerAchievements: NOT_PUBLIC,
      });

      const dashboardPromise = sut.getDashboard();

      await expect(dashboardPromise).rejects.toMatchObject({
        kind: 'private',
      });
    });
  });
});
