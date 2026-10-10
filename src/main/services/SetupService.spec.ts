import { describe, expect, it } from 'vitest';

import { type Language } from '@shared/i18n';
import { fakeSteamClient, type ISteamAnswers } from '@tests/fakeSteamClient';
import {
  fakeFetch,
  KEY,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
} from '@tests/helpers';
import { InMemoryStore } from '@tests/InMemoryStore';
import { achieved, game } from '@tests/steamLibrary';

import {
  type ICredentials,
  type IRawPlayerSummary,
  SteamClient,
  SteamError,
  type SteamErrorKind,
} from '../steam/SteamClient';

import { KeyStatus } from './KeyStatus';
import { SetupService } from './SetupService';

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

/**
 * A fresh app over a store in memory and a Steam that answers what it is
 * given, with the real key status over the same two. Its language is only
 * set when one is given.
 */
function setup(answers: ISteamAnswers = {}, language?: Language) {
  const store = new InMemoryStore();
  const client = fakeSteamClient(answers);
  const sut = new SetupService(store, client, new KeyStatus(store, client));
  if (language) sut.setLanguage(language);
  return { store, client, sut };
}

/** The app with one account, `STEAM_ID`, which it follows. */
async function withOneAccount(answers: ISteamAnswers = { summary }) {
  const made = setup(answers);
  await made.sut.addAccount(STEAM_ID, KEY);
  return made;
}

/** The app with two accounts, following the second one. */
async function withTwoAccounts() {
  const made = await withOneAccount();
  await made.sut.addAccount(OTHER_STEAM_ID, OTHER_KEY);
  return made;
}

describe('SetupService', () => {
  describe('getState', () => {
    it('should start unconfigured, in English', () => {
      const { sut } = setup();

      const state = sut.getState();

      expect(state).toEqual({
        isConfigured: false,
        language: 'en',
        profile: null,
        accounts: [],
        activeSteamId: null,
        achievementSort: { pending: 'common', unlocked: 'recent' },
        dashboardSort: { ongoing: 'closest', complete: 'completed' },
      });
    });

    it('should show of a key only how it ends', async () => {
      const { sut } = await withTwoAccounts();

      const state = sut.getState();

      expect(JSON.stringify(state)).not.toContain(KEY);
      expect(state.accounts[0].keyEnding).toBe(KEY.slice(-4));
    });
  });

  describe('addAccount', () => {
    it('should save nothing when Steam rejects the key', async () => {
      const { sut, store } = setup({ summary: failing('invalid-key') });

      const state = await sut.addAccount(STEAM_ID, KEY);

      expect(state.isConfigured).toBe(false);
      expect(store.getCredentials()).toBeNull();
    });

    it('should set the app up with the profile when Steam accepts the key', async () => {
      const { sut } = setup({ summary });

      const state = await sut.addAccount(STEAM_ID, KEY);

      expect(state).toMatchObject({
        isConfigured: true,
        profile: { steamId: STEAM_ID, name: 'player', avatar: 'x' },
      });
    });

    it('should save the key without the spaces around it', async () => {
      const { sut, store } = setup({ summary });

      await sut.addAccount(STEAM_ID, ` ${KEY} `);

      expect(store.getCredentials()).toEqual({
        steamId: STEAM_ID,
        apiKey: KEY,
      });
    });

    it('should follow an account as soon as it is added', async () => {
      const { sut } = await withOneAccount();

      const state = await sut.addAccount(OTHER_STEAM_ID, OTHER_KEY);

      expect(state).toMatchObject({
        activeSteamId: OTHER_STEAM_ID,
        accounts: [{ steamId: STEAM_ID }, { steamId: OTHER_STEAM_ID }],
      });
    });
  });

  describe('setLanguage', () => {
    it('should answer the state in the new language', () => {
      const { sut } = setup();

      const state = sut.setLanguage('pt-BR');

      expect(state.language).toBe('pt-BR');
    });

    it('should ask Steam in the new language from then on', async () => {
      const { sut, store } = setup();
      const fetchImpl = fakeFetch({
        GetGameAchievements: { json: { response: {} } },
      });
      // The real client, built as `index.ts` builds it: it asks the store
      // for the language on each request.
      const steam = new SteamClient(fetchImpl, () => store.getLanguage());

      sut.setLanguage('pt-BR');

      await steam.getGameAchievements(1);
      expect(fetchImpl.calls).toEqual([
        'https://api.steampowered.com/IPlayerService/GetGameAchievements/v1/?appid=1&language=brazilian',
      ]);
    });

    it('should write its messages in the new language', () => {
      const { sut } = setup();

      sut.setLanguage('pt-BR');

      expect(sut.messages.nav.dashboard).toBe('Painel');
    });
  });

  describe('checkApiKey', () => {
    it('should refuse an account that was already added', async () => {
      const { sut } = await withTwoAccounts();

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

  describe('setActiveAccount', () => {
    it('should follow another saved account when asked to', async () => {
      const { sut, store } = await withTwoAccounts();

      const state = sut.setActiveAccount(STEAM_ID);

      expect(state.activeSteamId).toBe(STEAM_ID);
      expect(store.getCredentials()).toEqual({
        steamId: STEAM_ID,
        apiKey: KEY,
      });
    });
  });

  describe('replaceKey', () => {
    it('should replace the key of an account without starting to follow it', async () => {
      const { sut, store } = await withTwoAccounts();

      const result = await sut.replaceKey(STEAM_ID, OTHER_KEY);

      expect(result).toMatchObject({
        ok: true,
        value: { activeSteamId: OTHER_STEAM_ID },
      });
      expect(store.getCredentialsOf(STEAM_ID)?.apiKey).toBe(OTHER_KEY);
    });

    it('should keep the old key when Steam refuses the new one', async () => {
      let isRefusing = false;
      const { sut, store } = await withOneAccount({
        summary: (credentials) =>
          isRefusing ? failing('invalid-key')() : summary(credentials),
      });
      isRefusing = true;

      const result = await sut.replaceKey(STEAM_ID, OTHER_KEY);

      expect(result).toEqual({ ok: false, error: KEY_REJECTED });
      expect(store.getCredentialsOf(STEAM_ID)?.apiKey).toBe(KEY);
    });
  });

  describe('removeAccount', () => {
    it('should move on to another account when the one in use is removed', async () => {
      const { sut } = await withTwoAccounts();

      const state = sut.removeAccount(OTHER_STEAM_ID);

      expect(state).toMatchObject({
        isConfigured: true,
        activeSteamId: STEAM_ID,
        accounts: [{ steamId: STEAM_ID }],
      });
    });

    it('should leave the app to be set up again when the last account is removed', async () => {
      const { sut } = await withOneAccount();

      const state = sut.removeAccount(STEAM_ID);

      expect(state).toMatchObject({ isConfigured: false, accounts: [] });
    });
  });

  describe('recheckAccount', () => {
    it('should record what Steam answers when asked again about a key', async () => {
      const { sut, store } = await withOneAccount();
      store.setAccountStatus(STEAM_ID, 'rejected');

      const state = await sut.recheckAccount(STEAM_ID);

      expect(state.accounts[0].status).toBe('valid');
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
  });
});
