import { describe, expect, it } from 'vitest';

import { fakeSteamClient, type ISteamAnswers } from '@tests/fakeSteamClient';
import {
  fakeFetch,
  KEY,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
} from '@tests/helpers';
import { InMemoryStore } from '@tests/InMemoryStore';

import {
  type ICredentials,
  type IRawPlayerSummary,
  SteamClient,
  SteamError,
  type SteamErrorKind,
} from '../steam/SteamClient';

import { AccountChecks } from './AccountChecks';
import { KeyStatus } from './KeyStatus';
import { SetupService } from './SetupService';

const KEY_REJECTED = 'Steam rejected the Web API key.';
const ALREADY_ADDED =
  'This account was already added. To change its key, use “Replace key” in Settings.';

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
 * given, with the real checks and key status over the same two.
 */
function setup(answers: ISteamAnswers = {}) {
  const store = new InMemoryStore();
  const client = fakeSteamClient(answers);
  const keys = new KeyStatus(store, client);
  const sut = new SetupService(
    store,
    new AccountChecks(store, client, keys),
    keys,
  );
  return { store, sut };
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
    it('should say why, and save nothing, when Steam rejects the key', async () => {
      const { sut, store } = setup({ summary: failing('invalid-key') });

      const result = await sut.addAccount(STEAM_ID, KEY);

      expect(result).toEqual({ ok: false, error: KEY_REJECTED });
      expect(store.getCredentials()).toBeNull();
    });

    it('should refuse an account the app already has, keeping its key', async () => {
      const { sut, store } = await withOneAccount();

      const result = await sut.addAccount(STEAM_ID, OTHER_KEY);

      expect(result).toEqual({ ok: false, error: ALREADY_ADDED });
      expect(store.getCredentialsOf(STEAM_ID)?.apiKey).toBe(KEY);
    });

    it('should set the app up with the profile when Steam accepts the key', async () => {
      const { sut } = setup({ summary });

      const result = await sut.addAccount(STEAM_ID, KEY);

      expect(result).toMatchObject({
        ok: true,
        value: {
          isConfigured: true,
          profile: { steamId: STEAM_ID, name: 'player', avatar: 'x' },
        },
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

      const result = await sut.addAccount(OTHER_STEAM_ID, OTHER_KEY);

      expect(result).toMatchObject({
        ok: true,
        value: {
          activeSteamId: OTHER_STEAM_ID,
          accounts: [{ steamId: STEAM_ID }, { steamId: OTHER_STEAM_ID }],
        },
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

    it('should replace the key in one write, so a disk that gives out after it leaves the app where it was', async () => {
      const { sut, store } = await withTwoAccounts();
      store.refuseWrites(1);

      const result = await sut.replaceKey(STEAM_ID, OTHER_KEY);

      expect(result).toMatchObject({
        ok: true,
        value: { activeSteamId: OTHER_STEAM_ID },
      });
    });

    it('should say so and keep the old key when the new one cannot be written', async () => {
      const { sut, store } = await withTwoAccounts();
      store.refuseWrites();

      const failure = await sut
        .replaceKey(STEAM_ID, OTHER_KEY)
        .catch((e: unknown) => e);

      expect(failure).toEqual(
        new Error('InMemoryStore: the write was refused'),
      );
      expect(store.getCredentialsOf(STEAM_ID)?.apiKey).toBe(KEY);
      expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
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

    it('should refuse, saving nothing, when the account is not one the app has', async () => {
      const { sut, store } = await withOneAccount();

      const result = await sut.replaceKey(OTHER_STEAM_ID, OTHER_KEY);

      expect(result).toEqual({
        ok: false,
        error: 'The app has not been set up yet.',
      });
      expect(store.getAccounts().map((a) => a.steamId)).toEqual([STEAM_ID]);
    });

    it('should save the key without the spaces around it', async () => {
      const { sut, store } = await withOneAccount();

      await sut.replaceKey(STEAM_ID, ` ${OTHER_KEY} `);

      expect(store.getCredentialsOf(STEAM_ID)?.apiKey).toBe(OTHER_KEY);
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

  describe('a change the disk refuses', () => {
    it.each<[string, (sut: SetupService) => unknown]>([
      ['follow another account', (sut) => sut.setActiveAccount(STEAM_ID)],
      ['remove an account', (sut) => sut.removeAccount(OTHER_STEAM_ID)],
      ['change the language', (sut) => sut.setLanguage('fr')],
    ])(
      'should say so and answer the state it had when asked to %s',
      async (_change, change) => {
        const { sut, store } = await withTwoAccounts();
        const before = sut.getState();
        store.refuseWrites();
        let failure: unknown = null;

        try {
          change(sut);
        } catch (e) {
          failure = e;
        }

        expect(failure).toEqual(
          new Error('InMemoryStore: the write was refused'),
        );
        expect(sut.getState()).toEqual(before);
      },
    );

    it('should say so and save nothing when an account Steam accepts cannot be written', async () => {
      const { sut, store } = await withOneAccount();
      const before = sut.getState();
      store.refuseWrites();

      const failure = await sut
        .addAccount(OTHER_STEAM_ID, OTHER_KEY)
        .catch((e: unknown) => e);

      expect(failure).toEqual(
        new Error('InMemoryStore: the write was refused'),
      );
      expect(sut.getState()).toEqual(before);
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
});
