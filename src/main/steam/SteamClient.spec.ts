import { describe, expect, it } from 'vitest';

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

import { SteamClient, SteamError } from './SteamClient';

const CREDENTIALS = { steamId: STEAM_ID, apiKey: KEY };

interface ISetupOverrides {
  language?: Language;
  apiBase?: string;
}

/**
 * A client whose Steam answers the given routes. It is in English until
 * `setLanguage` says otherwise.
 */
function setup(
  routes: Parameters<typeof fakeFetch>[0],
  { language = 'en', apiBase }: ISetupOverrides = {},
) {
  let current = language;
  const fetchImpl = fakeFetch(routes);
  const sut = new SteamClient(fetchImpl, () => current, apiBase);
  const setLanguage = (next: Language): void => {
    current = next;
  };
  return { sut, fetchImpl, setLanguage };
}

describe('SteamClient', () => {
  describe('getPlayerSummary', () => {
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
  });

  describe('getOwnedGames', () => {
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
