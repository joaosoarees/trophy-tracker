import { describe, expect, it } from 'vitest';

import { type Language } from '@shared/i18n';
import {
  fakeSteamClient,
  type ISteamAnswers,
  type SteamRequest,
} from '@tests/fakeSteamClient';
import { KEY, OTHER_KEY, OTHER_STEAM_ID, STEAM_ID } from '@tests/helpers';
import { InMemoryStore } from '@tests/InMemoryStore';
import { achieved, game } from '@tests/steamLibrary';

import {
  type ICredentials,
  type IRawPlayerSummary,
  SteamError,
  type SteamErrorKind,
} from '../steam/SteamClient';

import { AccountChecks } from './AccountChecks';
import { KeyStatus } from './KeyStatus';

const KEY_REJECTED = 'Steam rejected the Web API key.';
const PRIVACY_BLOCKED =
  'Steam did not allow reading your games. Set “Game details” to Public in your privacy settings.';

/** Steam knows whoever is asked about, and calls them "player". */
const summary = ({ steamId }: ICredentials): IRawPlayerSummary => ({
  steamid: steamId,
  personaname: 'player',
  avatarfull: 'x',
});

/** Steam failing a request the way the real client reports it. */
const failing = (kind: SteamErrorKind) => (): never => {
  throw new SteamError(kind);
};

/** The games Steam was asked about for what a player has in them, in order. */
const playerRequests = (client: { asked: SteamRequest[] }): number[] =>
  client.asked.flatMap((request) =>
    request.method === 'getPlayerAchievements' ? [request.appid] : [],
  );

/**
 * The checks of an app with no account, over a store in memory and a Steam
 * that answers what it is given. What a failure means comes from the real
 * key status, over the same two. The language is only set when one is given.
 */
function setup(answers: ISteamAnswers = {}, language?: Language) {
  const store = new InMemoryStore();
  if (language) store.setLanguage(language);
  const client = fakeSteamClient(answers);
  const sut = new AccountChecks(store, client, new KeyStatus(store, client));
  return { store, client, sut };
}

/** The same for an app that has two accounts, following the second one. */
function withTwoAccounts() {
  const made = setup({ summary });
  for (const [steamId, apiKey] of [
    [STEAM_ID, KEY],
    [OTHER_STEAM_ID, OTHER_KEY],
  ]) {
    made.store.setCredentials(
      { steamId, apiKey },
      { steamId, name: 'player', avatar: 'x' },
    );
  }
  return made;
}

describe('AccountChecks', () => {
  describe('checkApiKey', () => {
    it('should refuse an account that was already added', async () => {
      const { sut } = withTwoAccounts();

      const result = await sut.checkApiKey(STEAM_ID, OTHER_KEY);

      expect(result).toEqual({
        ok: false,
        error:
          'This account was already added. To change its key, use “Replace key” in Settings.',
      });
    });

    it('should reject a badly formed key before asking Steam', async () => {
      const { sut, client } = setup();

      const result = await sut.checkApiKey(STEAM_ID, 'short');

      expect(result).toEqual({
        ok: false,
        error: 'A Web API key has 32 characters (letters A to F and digits).',
      });
      expect(client.asked).toEqual([]);
    });

    it('should reject a badly formed SteamID before asking Steam', async () => {
      const { sut, client } = setup();

      const result = await sut.checkApiKey('12345', KEY);

      expect(result).toEqual({
        ok: false,
        error: 'A SteamID is a 17-digit number that starts with 7656.',
      });
      expect(client.asked).toEqual([]);
    });

    it('should report a SteamID that has no profile', async () => {
      const { sut } = setup({ summary: failing('not-found') });

      const result = await sut.checkApiKey(STEAM_ID, KEY);

      expect(result).toEqual({
        ok: false,
        error: 'No Steam profile was found with that SteamID.',
      });
    });

    it.each<{ language: Language; error: string }>([
      { language: 'en', error: KEY_REJECTED },
      { language: 'pt-BR', error: 'A Steam recusou a chave da Web API.' },
    ])(
      'should say in $language that Steam does not accept the key',
      async ({ language, error }) => {
        const { sut } = setup({ summary: failing('invalid-key') }, language);

        const result = await sut.checkApiKey(STEAM_ID, KEY);

        expect(result).toEqual({ ok: false, error });
      },
    );

    it('should answer the profile when Steam accepts the key', async () => {
      const { sut } = setup({ summary });

      const result = await sut.checkApiKey(STEAM_ID, KEY);

      expect(result).toEqual({
        ok: true,
        value: { steamId: STEAM_ID, name: 'player', avatar: 'x' },
      });
    });
  });

  describe('checkPrivacy', () => {
    it('should reject the profile when the library is not visible', async () => {
      const { sut } = setup({ owned: () => null });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: false, error: PRIVACY_BLOCKED });
    });

    it('should reject the profile when the achievements are not visible', async () => {
      const { sut } = setup({
        owned: () => [game(1, 'A', 10)],
        player: failing('private'),
      });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: false, error: PRIVACY_BLOCKED });
    });

    it('should count only the games that were played', async () => {
      const { sut } = setup({
        owned: () => [
          game(1, 'Played', 10, 200),
          game(2, 'Also played', 10, 100),
          game(3, 'Never opened', 0),
        ],
        player: () => achieved(1, 2),
      });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: true, value: { gamesWithPlaytime: 2 } });
    });

    it('should accept a profile whose most recent game has no achievements', async () => {
      const { sut } = setup({
        owned: () => [
          game(1, 'No achievements', 10, 200),
          game(2, 'With', 10, 100),
        ],
        player: (appid) =>
          appid === 1 ? failing('no-stats')() : achieved(1, 2),
      });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: true, value: { gamesWithPlaytime: 2 } });
    });

    it('should say so when Steam does not accept the key', async () => {
      const { sut } = setup({ owned: failing('invalid-key') });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: false, error: KEY_REJECTED });
    });

    it('should say Steam could not be reached when it stops answering as the achievements are read', async () => {
      const { sut } = setup({
        owned: () => [game(1, 'A', 10)],
        player: failing('network'),
      });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({
        ok: false,
        error: 'Could not reach Steam. Check your connection.',
      });
    });

    it('should ask about one game when the most recent one answers', async () => {
      const { sut, client } = setup({
        owned: () => [game(1, 'Older', 10, 100), game(2, 'Recent', 10, 200)],
        player: () => achieved(1, 2),
      });

      await sut.checkPrivacy(STEAM_ID, KEY);

      expect(playerRequests(client)).toEqual([2]);
    });

    it('should ask about the five most recent games and no other when none of them has achievements', async () => {
      const { sut, client } = setup({
        owned: () =>
          [1, 2, 3, 4, 5, 6, 7].map((appid) =>
            game(appid, `Game ${appid}`, 10, appid * 100),
          ),
        player: failing('no-stats'),
      });

      await sut.checkPrivacy(STEAM_ID, KEY);

      expect(playerRequests(client)).toEqual([7, 6, 5, 4, 3]);
    });

    it('should accept the profile when none of the games it asks about has achievements', async () => {
      const { sut } = setup({
        owned: () => [game(1, 'A', 10), game(2, 'B', 10)],
        player: failing('no-stats'),
      });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: true, value: { gamesWithPlaytime: 2 } });
    });

    it('should ask Steam with the SteamID and the key without the spaces around them', async () => {
      const { sut, client } = setup({ owned: () => [] });

      await sut.checkPrivacy(` ${STEAM_ID} `, ` ${KEY} `);

      expect(client.asked).toEqual([
        {
          method: 'getOwnedGames',
          credentials: { steamId: STEAM_ID, apiKey: KEY },
        },
      ]);
    });
  });
});
