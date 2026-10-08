import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SetupService } from '../src/main/services/SetupService';
import { SteamClient, SteamError } from '../src/main/steam/client';
import { Store } from '../src/main/storage/Store';

import { fakeFetch, FORBIDDEN_HTML, KEY, STEAM_ID } from './helpers';

const summary = {
  json: {
    response: {
      players: [{ steamid: STEAM_ID, personaname: 'joao', avatarfull: 'x' }],
    },
  },
};

function setup(routes: Parameters<typeof fakeFetch>[0] = {}) {
  const store = new Store(mkdtempSync(join(tmpdir(), 'stt-')));
  const client = new SteamClient(fakeFetch(routes));
  return { store, client, service: new SetupService(store, client) };
}

describe('SetupService', () => {
  it('starts unconfigured, in English', () => {
    expect(setup().service.getState()).toEqual({
      configured: false,
      language: 'en',
      profile: null,
      configError: null,
      achievementSort: { pending: 'common', unlocked: 'recent' },
      dashboardSort: { ongoing: 'closest', complete: 'completed' },
    });
  });

  it('saves the credentials only when Steam accepts the key', async () => {
    const rejected = setup({ GetPlayerSummaries: FORBIDDEN_HTML });
    expect((await rejected.service.saveConfig(STEAM_ID, KEY)).configured).toBe(
      false,
    );
    expect(rejected.store.getCredentials()).toBeNull();

    const accepted = setup({ GetPlayerSummaries: summary });
    const state = await accepted.service.saveConfig(STEAM_ID, ` ${KEY} `);
    expect(state).toMatchObject({
      configured: true,
      profile: { steamId: STEAM_ID, name: 'joao' },
    });
    expect(accepted.store.getCredentials()).toEqual({
      steamId: STEAM_ID,
      apiKey: KEY,
    });
  });

  it('sends the user back to the onboarding when Steam starts rejecting the key', async () => {
    const { service } = setup({ GetPlayerSummaries: summary });
    await service.saveConfig(STEAM_ID, KEY);

    const result = await service.attempt(() =>
      Promise.reject(new SteamError('invalid-key')),
    );

    expect(result).toEqual({
      ok: false,
      error: 'Steam rejected the Web API key.',
    });
    expect(service.getState()).toMatchObject({
      configured: false,
      configError: 'Steam rejected the Web API key.',
    });
  });

  it('keeps the setup on other failures and hides unexpected ones', async () => {
    const { service } = setup({ GetPlayerSummaries: summary });
    await service.saveConfig(STEAM_ID, KEY);

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

  it('erasing the setup forgets the credentials and the error', async () => {
    const { service, store } = setup({ GetPlayerSummaries: summary });
    await service.saveConfig(STEAM_ID, KEY);
    await service.attempt(() => Promise.reject(new SteamError('invalid-key')));

    expect(service.resetConfig()).toMatchObject({
      configured: false,
      configError: null,
    });
    expect(store.getCredentials()).toBeNull();
  });
});
