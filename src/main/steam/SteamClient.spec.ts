import { afterEach, describe, expect, it, vi } from 'vitest';

import { type Language } from '@shared/i18n';
import { en } from '@shared/i18n/locales/en';
import { ptBR } from '@shared/i18n/locales/pt-BR';
import nioh from '@tests/fixtures/game-achievements-3681010.json';
import {
  fakeFetch,
  FORBIDDEN_HTML,
  KEY,
  NO_STATS,
  NOT_PUBLIC,
  STEAM_ID,
} from '@tests/helpers';
import { achieved, game, owned, player } from '@tests/steamLibrary';

import { type Fetch, SteamClient, SteamError } from './SteamClient';

const CREDENTIALS = { steamId: STEAM_ID, apiKey: KEY };
const ASSETS = 'https://shared.fastly.steamstatic.com/store_item_assets';

/** The store's answer about the game 1, which has art, and no other game. */
const STORE_WITH_ART_OF_GAME_1 = {
  json: {
    response: {
      store_items: [
        {
          appid: 1,
          assets: {
            asset_url_format: 'steam/apps/1/${FILENAME}?t=9',
            header: 'abc/header.jpg',
            small_capsule: 'def/capsule_231x87.jpg',
          },
        },
      ],
    },
  },
};

interface ISetupOverrides {
  language?: Language;
  apiBase?: string;
  timeout?: () => AbortSignal;
}

/**
 * A client whose Steam answers the given routes. It is in English until
 * `setLanguage` says otherwise.
 */
function setup(
  routes: Parameters<typeof fakeFetch>[0],
  { language = 'en', apiBase, timeout }: ISetupOverrides = {},
) {
  let current = language;
  const fetchImpl = fakeFetch(routes);
  const sut = new SteamClient(fetchImpl, () => current, apiBase, timeout);
  const setLanguage = (next: Language): void => {
    current = next;
  };
  return { sut, fetchImpl, setLanguage };
}

/**
 * Steam taking a request and never answering it. As with the real `fetch`,
 * the request ends only when the signal it was given gives up, and fails with
 * the reason of that signal.
 */
const neverAnswers: Fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal;
    signal?.addEventListener('abort', () => reject(signal.reason as Error));
  });

/**
 * Steam starting an answer and never ending it: the status arrives, and the
 * text fails when the signal of the request gives up.
 */
const stopsHalfway: Fetch = (_input, init) =>
  Promise.resolve(
    new Response(
      new ReadableStream({
        start(controller) {
          const signal = init?.signal;
          controller.enqueue(new TextEncoder().encode('{"response":'));
          signal?.addEventListener('abort', () =>
            controller.error(signal.reason),
          );
        },
      }),
    ),
  );

/**
 * A client whose requests are given up on after a millisecond, the way the
 * real limit gives up on them, so no test waits for the real one.
 */
function setupShortLimit(fetchImpl: Fetch) {
  const sut = new SteamClient(
    fetchImpl,
    () => 'en',
    undefined,
    () => AbortSignal.timeout(1),
  );
  return { sut };
}

/** Every call the client offers, each of which asks Steam. */
const CALLS: { call: string; ask: (sut: SteamClient) => Promise<unknown> }[] = [
  {
    call: 'getPlayerSummary',
    ask: (sut) => sut.getPlayerSummary(CREDENTIALS),
  },
  { call: 'getOwnedGames', ask: (sut) => sut.getOwnedGames(CREDENTIALS) },
  { call: 'getGameAchievements', ask: (sut) => sut.getGameAchievements(1) },
  { call: 'getStoreArt', ask: (sut) => sut.getStoreArt([1]) },
  {
    call: 'getPlayerAchievements',
    ask: (sut) => sut.getPlayerAchievements(CREDENTIALS, 1),
  },
  { call: 'getUserStats', ask: (sut) => sut.getUserStats(CREDENTIALS, 1) },
];

describe('SteamClient', () => {
  describe('a request Steam does not answer', () => {
    it.each(CALLS)(
      'should refuse with network when Steam leaves $call unanswered until the limit passes',
      async ({ ask }) => {
        const { sut } = setupShortLimit(neverAnswers);

        const answerPromise = ask(sut);

        await expect(answerPromise).rejects.toThrow(new SteamError('network'));
      },
    );

    it('should refuse with network when an answer that started is not over as the limit passes', async () => {
      const { sut } = setupShortLimit(stopsHalfway);

      const gamesPromise = sut.getOwnedGames(CREDENTIALS);

      await expect(gamesPromise).rejects.toThrow(new SteamError('network'));
    });

    it('should give each request a limit of its own when a call asks Steam more than once', async () => {
      const limits: AbortSignal[] = [];
      const { sut, fetchImpl } = setup(
        { GetItems: STORE_WITH_ART_OF_GAME_1 },
        {
          timeout: () => {
            limits.push(new AbortController().signal);
            return limits[limits.length - 1];
          },
        },
      );
      const moreThanOneBatch = Array.from({ length: 51 }, (_, i) => i + 1);

      await sut.getStoreArt(moreThanOneBatch);

      expect(limits).toHaveLength(2);
      expect(fetchImpl.inits[0]?.signal).toBe(limits[0]);
      expect(fetchImpl.inits[1]?.signal).toBe(limits[1]);
    });

    it('should limit a request when it was built with no limit of its own', async () => {
      const fetchImpl = fakeFetch({ GetOwnedGames: owned() });
      const sut = new SteamClient(fetchImpl);

      await sut.getOwnedGames(CREDENTIALS);

      expect(fetchImpl.inits[0]?.signal).toBeInstanceOf(AbortSignal);
    });

    describe('with the limit users get', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should give a request fifteen seconds when it was built with no limit of its own', async () => {
        const timeoutMock = vi.spyOn(AbortSignal, 'timeout');
        const sut = new SteamClient(fakeFetch({ GetOwnedGames: owned() }));

        await sut.getOwnedGames(CREDENTIALS);

        expect(timeoutMock).toHaveBeenCalledExactlyOnceWith(15_000);
      });
    });
  });

  describe('an answer that refuses the request', () => {
    it.each([
      {
        what: 'the status 401',
        route: { status: 401, text: 'Unauthorized' },
        kind: 'invalid-key',
      },
      {
        what: 'the status 403 and JSON that gives no reason',
        route: { status: 403, json: {} },
        kind: 'private',
      },
      {
        what: 'the status 429',
        route: { status: 429, text: 'Too Many Requests' },
        kind: 'rate-limited',
      },
    ] as const)(
      'should refuse with $kind when Steam answers $what',
      async ({ route, kind }) => {
        const { sut } = setup({ GetOwnedGames: route });

        const gamesPromise = sut.getOwnedGames(CREDENTIALS);

        await expect(gamesPromise).rejects.toThrow(new SteamError(kind));
      },
    );
  });

  describe('getPlayerSummary', () => {
    it('should answer the profile when Steam knows the SteamID', async () => {
      const profile = {
        steamid: STEAM_ID,
        personaname: 'player',
        avatarfull: 'https://avatars.example/full.jpg',
        gameid: '3681010',
      };
      const { sut } = setup({
        GetPlayerSummaries: { json: { response: { players: [profile] } } },
      });

      const summary = await sut.getPlayerSummary(CREDENTIALS);

      expect(summary).toEqual(profile);
    });

    it('should refuse with invalid-key when Steam rejects the key', async () => {
      const { sut } = setup({ GetPlayerSummaries: FORBIDDEN_HTML });

      const summaryPromise = sut.getPlayerSummary(CREDENTIALS);

      await expect(summaryPromise).rejects.toThrow(
        new SteamError('invalid-key'),
      );
    });

    it('should refuse with not-found when the SteamID has no profile', async () => {
      const { sut } = setup({
        GetPlayerSummaries: { json: { response: { players: [] } } },
      });

      const summaryPromise = sut.getPlayerSummary(CREDENTIALS);

      await expect(summaryPromise).rejects.toThrow(new SteamError('not-found'));
    });

    it('should ask the address it was given when one replaces Steam', async () => {
      const { sut, fetchImpl } = setup(
        {
          GetPlayerSummaries: {
            json: { response: { players: [{ steamid: STEAM_ID }] } },
          },
        },
        { language: 'en', apiBase: 'http://127.0.0.1:9999' },
      );

      await sut.getPlayerSummary(CREDENTIALS);

      expect(fetchImpl.calls).toEqual([
        `http://127.0.0.1:9999/ISteamUser/GetPlayerSummaries/v2/?key=${KEY}&steamids=${STEAM_ID}`,
      ]);
    });
  });

  describe('getPlayerAchievements', () => {
    it.each([
      { what: 'the profile is private', route: NOT_PUBLIC, kind: 'private' },
      {
        what: 'the game has no achievements',
        route: NO_STATS,
        kind: 'no-stats',
      },
    ] as const)(
      'should refuse with $kind when $what',
      async ({ route, kind }) => {
        const { sut } = setup({ GetPlayerAchievements: route });

        const achievementsPromise = sut.getPlayerAchievements(CREDENTIALS, 1);

        await expect(achievementsPromise).rejects.toThrow(new SteamError(kind));
      },
    );

    it('should answer what the player has in the game when Steam lists it', async () => {
      const { sut } = setup({ GetPlayerAchievements: player(1, 3) });

      const achievements = await sut.getPlayerAchievements(CREDENTIALS, 7);

      expect(achievements).toEqual(achieved(1, 3));
    });

    it('should answer nothing when Steam sends no list for the game', async () => {
      const { sut } = setup({
        GetPlayerAchievements: { json: { playerstats: { success: true } } },
      });

      const achievements = await sut.getPlayerAchievements(CREDENTIALS, 7);

      expect(achievements).toEqual([]);
    });

    it('should ask about the game with the key and the SteamID of the account', async () => {
      const { sut, fetchImpl } = setup({ GetPlayerAchievements: player(1, 3) });

      await sut.getPlayerAchievements(CREDENTIALS, 7);

      expect(fetchImpl.calls).toEqual([
        `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${KEY}&steamid=${STEAM_ID}&appid=7`,
      ]);
    });

    it('should refuse with invalid-key when Steam rejects the key', async () => {
      const { sut } = setup({ GetPlayerAchievements: FORBIDDEN_HTML });

      const achievementsPromise = sut.getPlayerAchievements(CREDENTIALS, 7);

      await expect(achievementsPromise).rejects.toThrow(
        new SteamError('invalid-key'),
      );
    });
  });

  describe('getUserStats', () => {
    it('should answer the counters by name when the game has them', async () => {
      const { sut } = setup({
        GetUserStatsForGame: {
          json: {
            playerstats: {
              stats: [
                { name: 'ACH_001_PROGRESS', value: 12 },
                { name: 'KILLS', value: 340 },
              ],
            },
          },
        },
      });

      const stats = await sut.getUserStats(CREDENTIALS, 7);

      expect(stats).toEqual({ ACH_001_PROGRESS: 12, KILLS: 340 });
    });

    it('should answer no counters when Steam sends none for the game', async () => {
      const { sut } = setup({
        GetUserStatsForGame: { json: { playerstats: {} } },
      });

      const stats = await sut.getUserStats(CREDENTIALS, 7);

      expect(stats).toEqual({});
    });

    it('should ask about the game with the key and the SteamID of the account', async () => {
      const { sut, fetchImpl } = setup({
        GetUserStatsForGame: { json: { playerstats: {} } },
      });

      await sut.getUserStats(CREDENTIALS, 7);

      expect(fetchImpl.calls).toEqual([
        `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?key=${KEY}&steamid=${STEAM_ID}&appid=7`,
      ]);
    });

    it('should refuse with unknown and the status when Steam fails without saying why', async () => {
      const { sut } = setup({
        GetUserStatsForGame: { status: 500, text: 'error' },
      });

      const statsPromise = sut.getUserStats(CREDENTIALS, 7);

      await expect(statsPromise).rejects.toMatchObject({
        kind: 'unknown',
        status: 500,
        detail: '',
      });
    });
  });

  describe('getStoreArt', () => {
    it('should answer the header and the capsule of a game at the address the store gives', async () => {
      const { sut } = setup({ GetItems: STORE_WITH_ART_OF_GAME_1 });

      const art = await sut.getStoreArt([1]);

      expect(art).toEqual(
        new Map([
          [
            1,
            {
              header: `${ASSETS}/steam/apps/1/abc/header.jpg?t=9`,
              capsule: `${ASSETS}/steam/apps/1/def/capsule_231x87.jpg?t=9`,
            },
          ],
        ]),
      );
    });

    it('should leave out a game the store does not list', async () => {
      const { sut } = setup({ GetItems: STORE_WITH_ART_OF_GAME_1 });

      const art = await sut.getStoreArt([1, 2]);

      expect([...art.keys()]).toEqual([1]);
    });

    it('should answer empty addresses for a game the store lists without art', async () => {
      const { sut } = setup({
        GetItems: { json: { response: { store_items: [{ appid: 1 }] } } },
      });

      const art = await sut.getStoreArt([1]);

      expect(art).toEqual(new Map([[1, { header: '', capsule: '' }]]));
    });

    it('should answer no art when the store sends no list', async () => {
      const { sut } = setup({ GetItems: { json: { response: {} } } });

      const art = await sut.getStoreArt([1]);

      expect(art).toEqual(new Map());
    });

    it('should ask for the art of the games with no key, in the language and the country of the app', async () => {
      const { sut, fetchImpl } = setup(
        { GetItems: STORE_WITH_ART_OF_GAME_1 },
        { language: 'pt-BR' },
      );

      await sut.getStoreArt([1, 2]);

      const asked = new URL(fetchImpl.calls[0]);
      expect([...asked.searchParams.keys()]).toEqual(['input_json']);
      expect(JSON.parse(asked.searchParams.get('input_json') ?? '')).toEqual({
        ids: [{ appid: 1 }, { appid: 2 }],
        context: { language: 'brazilian', country_code: 'BR' },
        data_request: { include_assets: true },
      });
    });

    it('should ask the store about fifty games at a time when it is asked about more', async () => {
      const { sut, fetchImpl } = setup({ GetItems: STORE_WITH_ART_OF_GAME_1 });
      const appids = Array.from({ length: 120 }, (_, i) => i + 1);

      await sut.getStoreArt(appids);

      const asked = fetchImpl.calls.map((call) => {
        const input = new URL(call).searchParams.get('input_json') ?? '';
        const { ids } = JSON.parse(input) as { ids: { appid: number }[] };
        return ids.map(({ appid }) => appid);
      });
      expect(asked).toEqual([
        appids.slice(0, 50),
        appids.slice(50, 100),
        appids.slice(100),
      ]);
    });

    it('should answer the art of the games of every request when it asks the store more than once', async () => {
      const artOf = (appid: number) => ({
        appid,
        assets: {
          asset_url_format: `steam/apps/${appid}/\${FILENAME}`,
          header: 'header.jpg',
          small_capsule: 'capsule.jpg',
        },
      });
      const { sut } = setup({
        GetItems: (url) => {
          const input = url.searchParams.get('input_json') ?? '';
          const { ids } = JSON.parse(input) as { ids: { appid: number }[] };
          return {
            json: { response: { store_items: [artOf(ids[0].appid)] } },
          };
        },
      });
      const appids = Array.from({ length: 51 }, (_, i) => i + 1);

      const art = await sut.getStoreArt(appids);

      expect(art).toEqual(
        new Map([
          [
            1,
            {
              header: `${ASSETS}/steam/apps/1/header.jpg`,
              capsule: `${ASSETS}/steam/apps/1/capsule.jpg`,
            },
          ],
          [
            51,
            {
              header: `${ASSETS}/steam/apps/51/header.jpg`,
              capsule: `${ASSETS}/steam/apps/51/capsule.jpg`,
            },
          ],
        ]),
      );
    });

    it('should refuse with unknown when the store fails', async () => {
      const { sut } = setup({ GetItems: { status: 500, text: 'error' } });

      const artPromise = sut.getStoreArt([1]);

      await expect(artPromise).rejects.toMatchObject({
        kind: 'unknown',
        status: 500,
      });
    });
  });

  describe('getOwnedGames', () => {
    it('should answer the games of the library when it is visible', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(game(1, 'A', 10, 900), game(2, 'B', 0)),
      });

      const games = await sut.getOwnedGames(CREDENTIALS);

      expect(games).toEqual([game(1, 'A', 10, 900), game(2, 'B', 0)]);
    });

    it('should ask for the names and the free games played, with the key and the SteamID', async () => {
      const { sut, fetchImpl } = setup({ GetOwnedGames: owned() });

      await sut.getOwnedGames(CREDENTIALS);

      expect(fetchImpl.calls).toEqual([
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1`,
      ]);
    });

    it('should refuse with invalid-key when Steam rejects the key', async () => {
      const { sut } = setup({ GetOwnedGames: FORBIDDEN_HTML });

      const gamesPromise = sut.getOwnedGames(CREDENTIALS);

      await expect(gamesPromise).rejects.toThrow(new SteamError('invalid-key'));
    });

    it('should answer null when the library is not visible', async () => {
      const { sut } = setup({ GetOwnedGames: { json: { response: {} } } });

      const games = await sut.getOwnedGames(CREDENTIALS);

      expect(games).toBeNull();
    });

    it('should answer no games when the library is empty', async () => {
      const { sut } = setup({
        GetOwnedGames: { json: { response: { game_count: 0 } } },
      });

      const games = await sut.getOwnedGames(CREDENTIALS);

      expect(games).toEqual([]);
    });
  });

  describe('getGameAchievements', () => {
    it('should answer the achievements of the game when Steam has them', async () => {
      const { sut } = setup({ GetGameAchievements: { json: nioh } });

      const achievements = await sut.getGameAchievements(3681010);

      expect(achievements).toEqual(nioh.response.achievements);
    });

    it('should answer no achievements when Steam lists none for the game', async () => {
      const { sut } = setup({
        GetGameAchievements: { json: { response: {} } },
      });

      const achievements = await sut.getGameAchievements(7);

      expect(achievements).toEqual([]);
    });

    it('should ask with no key and in English when no language was chosen', async () => {
      const fetchImpl = fakeFetch({ GetGameAchievements: { json: nioh } });
      const sut = new SteamClient(fetchImpl);

      await sut.getGameAchievements(3681010);

      expect(fetchImpl.calls).toEqual([
        'https://api.steampowered.com/IPlayerService/GetGameAchievements/v1/?appid=3681010&language=english',
      ]);
    });

    it('should ask in the language it is given when one was chosen', async () => {
      const { sut, fetchImpl } = setup(
        { GetGameAchievements: { json: nioh } },
        { language: 'pt-BR' },
      );

      await sut.getGameAchievements(3681010);

      expect(fetchImpl.calls).toEqual([
        'https://api.steampowered.com/IPlayerService/GetGameAchievements/v1/?appid=3681010&language=brazilian',
      ]);
    });

    it('should ask in the new language when the language changes after the client was built', async () => {
      const { sut, fetchImpl, setLanguage } = setup({
        GetGameAchievements: { json: nioh },
      });
      setLanguage('pt-BR');

      await sut.getGameAchievements(3681010);

      expect(fetchImpl.calls).toEqual([
        'https://api.steampowered.com/IPlayerService/GetGameAchievements/v1/?appid=3681010&language=brazilian',
      ]);
    });

    it('should refuse with network when Steam cannot be reached', async () => {
      const sut = new SteamClient(() =>
        Promise.reject(new TypeError('fetch failed')),
      );

      const achievementsPromise = sut.getGameAchievements(1);

      await expect(achievementsPromise).rejects.toThrow(
        new SteamError('network'),
      );
    });
  });

  describe('SteamError.describe', () => {
    it.each([
      { kind: 'invalid-key', message: 'Steam rejected the Web API key.' },
      {
        kind: 'private',
        message: 'Your profile’s game details are not public.',
      },
      { kind: 'no-stats', message: 'This game has no achievements.' },
      {
        kind: 'not-found',
        message: 'No Steam profile was found with that SteamID.',
      },
      {
        kind: 'network',
        message: 'Could not reach Steam. Check your connection.',
      },
      {
        kind: 'rate-limited',
        message: 'Steam is limiting this key for now. It resumes by itself.',
      },
      { kind: 'not-configured', message: 'The app has not been set up yet.' },
    ] as const)(
      'should answer the text of $kind when asked in English',
      ({ kind, message }) => {
        const sut = new SteamError(kind);

        const text = sut.describe(en);

        expect(text).toBe(message);
      },
    );

    it('should answer the text in Portuguese when asked in Portuguese', () => {
      const sut = new SteamError('invalid-key');

      const text = sut.describe(ptBR);

      expect(text).toBe('A Steam recusou a chave da Web API.');
    });

    it('should answer the status when Steam sent no text with an unknown error', () => {
      const sut = new SteamError('unknown', 502);

      const text = sut.describe(ptBR);

      expect(text).toBe('A Steam respondeu com erro 502.');
    });

    it("should answer Steam's own text when an unknown error carries one", () => {
      const sut = new SteamError('unknown', 400, 'Bad appid');

      const text = sut.describe(en);

      expect(text).toBe('Bad appid');
    });
  });
});
