import { statSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { type Language } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';
import {
  fakeFetch,
  FORBIDDEN_HTML,
  KEY,
  makeTempDir,
  NO_STATS,
  NOT_PUBLIC,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
} from '@tests/helpers';
import { game, owned, player } from '@tests/steamLibrary';

import { SteamClient, SteamError } from '../steam/SteamClient';
import { Store } from '../storage/Store';

import { SetupService } from './SetupService';

const KEY_REJECTED = 'Steam rejected the Web API key.';
const PRIVACY_BLOCKED =
  'Steam did not allow reading your games. Set “Game details” to Public in your privacy settings.';

/** Steam knows whoever is asked about, and calls them "player". */
const summary = (url: URL) => ({
  json: {
    response: {
      players: [
        {
          steamid: url.searchParams.get('steamids'),
          personaname: 'player',
          avatarfull: 'x',
        },
      ],
    },
  },
});

/** A fresh app. Its language is only set when one is given. */
function setup(
  routes: Parameters<typeof fakeFetch>[0] = {},
  language?: Language,
) {
  const dir = makeTempDir();
  const store = new Store(dir);
  const fetchImpl = fakeFetch(routes);
  const client = new SteamClient(fetchImpl, () => store.getLanguage());
  const changes: IAppState[] = [];
  const logErrorMock = vi.fn<(source: string, detail: string) => void>();
  const sut = new SetupService(
    store,
    client,
    (state) => changes.push(state),
    logErrorMock,
  );
  if (language) sut.setLanguage(language);
  return { dir, store, client, sut, changes, fetchImpl, logErrorMock };
}

/** The app with one account, `STEAM_ID`, which it follows. */
async function withOneAccount(
  routes: Parameters<typeof fakeFetch>[0] = { GetPlayerSummaries: summary },
) {
  const made = setup(routes);
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
      const { sut, store } = setup({ GetPlayerSummaries: FORBIDDEN_HTML });

      const state = await sut.addAccount(STEAM_ID, KEY);

      expect(state.isConfigured).toBe(false);
      expect(store.getCredentials()).toBeNull();
    });

    it('should set the app up with the profile when Steam accepts the key', async () => {
      const { sut } = setup({ GetPlayerSummaries: summary });

      const state = await sut.addAccount(STEAM_ID, KEY);

      expect(state).toMatchObject({
        isConfigured: true,
        profile: { steamId: STEAM_ID, name: 'player', avatar: 'x' },
      });
    });

    it('should save the key without the spaces around it', async () => {
      const { sut, store } = setup({ GetPlayerSummaries: summary });

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

  describe('attempt', () => {
    it('should keep the app open and mark the account when Steam starts rejecting its key', async () => {
      const { sut, changes } = await withOneAccount();

      const result = await sut.attempt(() =>
        Promise.reject(new SteamError('invalid-key')),
      );

      expect(result).toEqual({ ok: false, error: KEY_REJECTED });
      expect(sut.getState()).toMatchObject({
        isConfigured: true,
        accounts: [{ steamId: STEAM_ID, status: 'rejected' }],
      });
      expect(changes).toEqual([
        expect.objectContaining({
          accounts: [expect.objectContaining({ status: 'rejected' })],
        }),
      ]);
    });

    it('should mark the account as limited when Steam asks it to slow down', async () => {
      const { sut } = await withOneAccount();

      await sut.attempt(() => Promise.reject(new SteamError('rate-limited')));

      expect(sut.getState().accounts[0].status).toBe('rateLimited');
    });

    it('should take the mark off when a read works again', async () => {
      const { sut } = await withOneAccount();
      await sut.attempt(() => Promise.reject(new SteamError('rate-limited')));

      await sut.attempt(() => Promise.resolve('read'));

      expect(sut.getState().accounts[0].status).toBe('valid');
    });

    it('should announce nothing when a read only confirms what was known', async () => {
      const { sut, changes } = await withOneAccount();

      await sut.attempt(() => Promise.resolve('read'));

      expect(changes).toEqual([]);
    });

    it('should leave the account as it was when Steam cannot be reached', async () => {
      const { sut, changes } = await withOneAccount();

      const result = await sut.attempt(() =>
        Promise.reject(new SteamError('network')),
      );

      expect(result).toEqual({
        ok: false,
        error: 'Could not reach Steam. Check your connection.',
      });
      expect(sut.getState().accounts[0].status).toBe('valid');
      expect(changes).toEqual([]);
    });

    it('should hide the details of an unexpected error', async () => {
      const { sut, changes, logErrorMock } = await withOneAccount();

      const result = await sut.attempt(() => Promise.reject(new Error('boom')));

      expect(result).toEqual({
        ok: false,
        error: 'Unexpected error. Try again.',
      });
      expect(sut.getState().accounts[0].status).toBe('valid');
      expect(changes).toEqual([]);
      expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
        'main: steam read',
        expect.stringContaining('boom'),
      );
    });

    it.each(['invalid-key', 'network'] as const)(
      'should log nothing when the read fails with %s, which Steam is known to answer',
      async (kind) => {
        const { sut, logErrorMock } = await withOneAccount();

        await sut.attempt(() => Promise.reject(new SteamError(kind)));

        expect(logErrorMock).not.toHaveBeenCalled();
      },
    );
  });

  describe('setLanguage', () => {
    it('should answer the state in the new language', () => {
      const { sut } = setup();

      const state = sut.setLanguage('pt-BR');

      expect(state.language).toBe('pt-BR');
    });

    it('should ask Steam in the new language from then on', async () => {
      const { sut, client, fetchImpl } = setup({
        GetGameAchievements: { json: { response: {} } },
      });

      sut.setLanguage('pt-BR');

      await client.getGameAchievements(1);
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
      const { sut, fetchImpl } = setup();

      const result = await sut.checkApiKey(STEAM_ID, 'short');

      expect(result).toEqual({
        ok: false,
        error: 'A Web API key has 32 characters (letters A to F and digits).',
      });
      expect(fetchImpl.calls).toHaveLength(0);
    });

    it('should reject a badly formed SteamID before asking Steam', async () => {
      const { sut, fetchImpl } = setup();

      const result = await sut.checkApiKey('12345', KEY);

      expect(result).toEqual({
        ok: false,
        error: 'A SteamID is a 17-digit number that starts with 7656.',
      });
      expect(fetchImpl.calls).toHaveLength(0);
    });

    it('should report a SteamID that has no profile', async () => {
      const { sut } = setup({
        GetPlayerSummaries: { json: { response: { players: [] } } },
      });

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
        const { sut } = setup({ GetPlayerSummaries: FORBIDDEN_HTML }, language);

        const result = await sut.checkApiKey(STEAM_ID, KEY);

        expect(result).toEqual({ ok: false, error });
      },
    );

    it('should answer the profile when Steam accepts the key', async () => {
      const { sut } = setup({ GetPlayerSummaries: summary });

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
        GetPlayerSummaries: (url) =>
          isRefusing ? FORBIDDEN_HTML : summary(url),
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

    it('should leave the saved file alone when Steam answers what was already known', async () => {
      const { sut, dir } = await withOneAccount();
      const file = join(dir, 'config.json');
      const before = new Date('2020-01-01T00:00:00Z');
      utimesSync(file, before, before);

      await sut.recheckAccount(STEAM_ID);

      expect(statSync(file).mtime).toEqual(before);
    });

    it('should save the new status when Steam answers something else', async () => {
      const { sut, dir, store } = await withOneAccount();
      store.setAccountStatus(STEAM_ID, 'rejected');
      const file = join(dir, 'config.json');
      const before = new Date('2020-01-01T00:00:00Z');
      utimesSync(file, before, before);

      await sut.recheckAccount(STEAM_ID);

      expect(statSync(file).mtime).not.toEqual(before);
    });
  });

  describe('checkPrivacy', () => {
    it('should reject the profile when the library is not visible', async () => {
      const { sut } = setup({ GetOwnedGames: { json: { response: {} } } });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: false, error: PRIVACY_BLOCKED });
    });

    it('should reject the profile when the achievements are not visible', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(game(1, 'A', 10)),
        GetPlayerAchievements: NOT_PUBLIC,
      });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: false, error: PRIVACY_BLOCKED });
    });

    it('should count only the games that were played', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(
          game(1, 'Played', 10, 200),
          game(2, 'Also played', 10, 100),
          game(3, 'Never opened', 0),
        ),
        GetPlayerAchievements: player(1, 2),
      });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: true, value: { gamesWithPlaytime: 2 } });
    });

    it('should accept a profile whose most recent game has no achievements', async () => {
      const { sut } = setup({
        GetOwnedGames: owned(
          game(1, 'No achievements', 10, 200),
          game(2, 'With', 10, 100),
        ),
        'appid=1': NO_STATS,
        'appid=2': player(1, 2),
      });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: true, value: { gamesWithPlaytime: 2 } });
    });

    it('should say so when Steam does not accept the key', async () => {
      const { sut } = setup({ GetOwnedGames: FORBIDDEN_HTML });

      const result = await sut.checkPrivacy(STEAM_ID, KEY);

      expect(result).toEqual({ ok: false, error: KEY_REJECTED });
    });
  });
});
