import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SetupService } from '@main/services/SetupService';
import { SteamClient, SteamError } from '@main/steam/client';
import { Store } from '@main/storage/Store';
import { type IAppState } from '@shared/types/AppState';
import {
  fakeFetch,
  FORBIDDEN_HTML,
  KEY,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
} from '@test/helpers';

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

function setup(routes: Parameters<typeof fakeFetch>[0] = {}) {
  const store = new Store(mkdtempSync(join(tmpdir(), 'stt-')));
  const client = new SteamClient(fakeFetch(routes));
  const changes: IAppState[] = [];
  const service = new SetupService(store, client, (state) =>
    changes.push(state),
  );
  return { store, client, service, changes };
}

/** The app with two accounts, following the second one. */
async function withTwoAccounts() {
  const made = setup({ GetPlayerSummaries: summary });
  await made.service.addAccount(STEAM_ID, KEY);
  await made.service.addAccount(OTHER_STEAM_ID, OTHER_KEY);
  return made;
}

describe('SetupService', () => {
  it('starts unconfigured, in English', () => {
    expect(setup().service.getState()).toEqual({
      configured: false,
      language: 'en',
      profile: null,
      accounts: [],
      activeSteamId: null,
      achievementSort: { pending: 'common', unlocked: 'recent' },
      dashboardSort: { ongoing: 'closest', complete: 'completed' },
    });
  });

  it('saves nothing when Steam rejects the key', async () => {
    const { service, store } = setup({ GetPlayerSummaries: FORBIDDEN_HTML });

    const state = await service.addAccount(STEAM_ID, KEY);

    expect(state.configured).toBe(false);
    expect(store.getCredentials()).toBeNull();
  });

  it('saves the credentials, trimmed, when Steam accepts the key', async () => {
    const { service, store } = setup({ GetPlayerSummaries: summary });

    const state = await service.addAccount(STEAM_ID, ` ${KEY} `);

    expect(state).toMatchObject({
      configured: true,
      profile: { steamId: STEAM_ID, name: 'player' },
    });
    expect(store.getCredentials()).toEqual({
      steamId: STEAM_ID,
      apiKey: KEY,
    });
  });

  it('keeps the app open and marks the account when Steam starts rejecting its key', async () => {
    const { service, changes } = setup({ GetPlayerSummaries: summary });
    await service.addAccount(STEAM_ID, KEY);

    const result = await service.attempt(() =>
      Promise.reject(new SteamError('invalid-key')),
    );

    expect(result).toEqual({
      ok: false,
      error: 'Steam rejected the Web API key.',
    });
    expect(service.getState()).toMatchObject({
      configured: true,
      accounts: [{ steamId: STEAM_ID, status: 'rejected' }],
    });
    expect(changes).toHaveLength(1);
  });

  it('marks the account as limited when Steam asks it to slow down', async () => {
    const { service } = setup({ GetPlayerSummaries: summary });
    await service.addAccount(STEAM_ID, KEY);

    await service.attempt(() => Promise.reject(new SteamError('rate-limited')));

    expect(service.getState().accounts[0].status).toBe('rateLimited');
  });

  it('takes the mark off once a read works again', async () => {
    const { service } = setup({ GetPlayerSummaries: summary });
    await service.addAccount(STEAM_ID, KEY);
    await service.attempt(() => Promise.reject(new SteamError('rate-limited')));

    await service.attempt(() => Promise.resolve('read'));

    expect(service.getState().accounts[0].status).toBe('valid');
  });

  it('says nothing when a read only confirms what was known', async () => {
    const { service, changes } = setup({ GetPlayerSummaries: summary });
    await service.addAccount(STEAM_ID, KEY);

    await service.attempt(() => Promise.resolve('read'));

    expect(changes).toEqual([]);
  });

  it('keeps the setup on other failures and hides unexpected ones', async () => {
    const { service } = setup({ GetPlayerSummaries: summary });
    await service.addAccount(STEAM_ID, KEY);

    expect(
      await service.attempt(() => Promise.reject(new SteamError('network'))),
    ).toEqual({
      ok: false,
      error: 'Could not reach Steam. Check your connection.',
    });
    expect(
      await service.attempt(() => Promise.reject(new Error('boom'))),
    ).toEqual({ ok: false, error: 'Unexpected error. Try again.' });
    expect(service.isConfigured).toBe(true);
  });

  it('changes the language of messages and of what is asked of Steam', () => {
    const { service, client } = setup();
    expect(client.language).toBe('en');

    expect(service.setLanguage('pt-BR').language).toBe('pt-BR');

    expect(client.language).toBe('pt-BR');
    expect(service.messages.nav.dashboard).toBe('Painel');
  });

  it('follows an account as soon as it is added', async () => {
    const { service } = await withTwoAccounts();

    expect(service.getState()).toMatchObject({
      activeSteamId: OTHER_STEAM_ID,
      accounts: [{ steamId: STEAM_ID }, { steamId: OTHER_STEAM_ID }],
    });
  });

  it('shows of a key only how it ends', async () => {
    const { service } = await withTwoAccounts();

    expect(JSON.stringify(service.getState())).not.toContain(KEY);
    expect(service.getState().accounts[0].keyEnding).toBe(KEY.slice(-4));
  });

  it('refuses to add an account that is already there', async () => {
    const { service } = await withTwoAccounts();

    expect(await service.checkApiKey(STEAM_ID, OTHER_KEY)).toEqual({
      ok: false,
      error:
        'This account was already added. To change its key, use “Replace key” in Settings.',
    });
  });

  it('follows another saved account when asked to', async () => {
    const { service, store } = await withTwoAccounts();

    const state = service.setActiveAccount(STEAM_ID);

    expect(state.activeSteamId).toBe(STEAM_ID);
    expect(store.getCredentials()).toEqual({ steamId: STEAM_ID, apiKey: KEY });
  });

  it('replaces the key of an account without starting to follow it', async () => {
    const { service, store } = await withTwoAccounts();

    const result = await service.replaceKey(STEAM_ID, OTHER_KEY);

    expect(result).toMatchObject({
      ok: true,
      value: { activeSteamId: OTHER_STEAM_ID },
    });
    expect(store.getCredentialsOf(STEAM_ID)?.apiKey).toBe(OTHER_KEY);
  });

  it('keeps the old key when Steam refuses the new one', async () => {
    const { service, store } = setup({ GetPlayerSummaries: summary });
    await service.addAccount(STEAM_ID, KEY);
    const refusing = new SetupService(
      store,
      new SteamClient(fakeFetch({ GetPlayerSummaries: FORBIDDEN_HTML })),
    );

    const result = await refusing.replaceKey(STEAM_ID, OTHER_KEY);

    expect(result.ok).toBe(false);
    expect(store.getCredentialsOf(STEAM_ID)?.apiKey).toBe(KEY);
  });

  it('removing the account in use moves on to another one', async () => {
    const { service } = await withTwoAccounts();

    const state = service.removeAccount(OTHER_STEAM_ID);

    expect(state).toMatchObject({
      configured: true,
      activeSteamId: STEAM_ID,
      accounts: [{ steamId: STEAM_ID }],
    });
  });

  it('removing the last account leaves the app to be set up again', async () => {
    const { service } = setup({ GetPlayerSummaries: summary });
    await service.addAccount(STEAM_ID, KEY);

    expect(service.removeAccount(STEAM_ID)).toMatchObject({
      configured: false,
      accounts: [],
    });
  });

  it('asks Steam again about a key and records the answer', async () => {
    const { service, store } = setup({ GetPlayerSummaries: summary });
    await service.addAccount(STEAM_ID, KEY);
    store.setAccountStatus(STEAM_ID, 'rejected');

    const state = await service.recheckAccount(STEAM_ID);

    expect(state.accounts[0].status).toBe('valid');
  });
});
