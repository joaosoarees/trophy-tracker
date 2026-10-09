import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createRunningGameSource } from '@main/services/runningGame';
import { SteamClient } from '@main/steam/client';
import { type ISteamLocal } from '@main/steam/local';
import { Store } from '@main/storage/Store';
import { fakeFetch, KEY, OTHER_STEAM_ID, STEAM_ID } from '@test/helpers';

describe('createRunningGameSource', () => {
  const localWithoutTracking: ISteamLocal = {
    tracksRunningGame: false,
    getRunningAppId: () => Promise.resolve(null),
    getActiveSteamId: () => Promise.resolve(null),
    readStatMap: () => Promise.resolve(new Map()),
  };

  function setup(summary: () => object, interval?: number) {
    const store = new Store(mkdtempSync(join(tmpdir(), 'tt-')));
    const fetchImpl = fakeFetch({
      GetPlayerSummaries: () => summary(),
    });
    let now = 0;
    const source = createRunningGameSource({
      local: localWithoutTracking,
      client: new SteamClient(fetchImpl),
      store,
      now: () => now,
      interval,
    });
    const configure = () =>
      store.setCredentials(
        { steamId: STEAM_ID, apiKey: KEY },
        { steamId: STEAM_ID, name: 'player', avatar: '' },
      );
    return {
      store,
      source,
      fetchImpl,
      configure,
      advance: (ms: number) => (now += ms),
    };
  }
  const playing = (gameid?: string) => ({
    json: {
      response: {
        players: [
          { steamid: STEAM_ID, personaname: 'j', avatarfull: '', gameid },
        ],
      },
    },
  });

  it('uses the registry where the system has one, without calling the API', async () => {
    const getRunningAppId = vi.fn(() => Promise.resolve(42));
    const { fetchImpl } = setup(() => playing('1'));
    const source = createRunningGameSource({
      local: {
        ...localWithoutTracking,
        tracksRunningGame: true,
        getRunningAppId,
      },
      client: new SteamClient(fetchImpl),
      store: new Store(mkdtempSync(join(tmpdir(), 'tt-'))),
    });
    expect(await source()).toBe(42);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('asks the API for the game in the profile, once every half minute', async () => {
    let game: string | undefined = '105600';
    const { source, fetchImpl, configure, advance } = setup(() =>
      playing(game),
    );
    expect(await source()).toBeNull();
    expect(fetchImpl.calls).toHaveLength(0);

    configure();
    expect(await source()).toBe(105600);
    game = undefined;
    advance(10_000);
    expect(await source()).toBe(105600);
    expect(fetchImpl.calls).toHaveLength(1);

    advance(25_000);
    expect(await source()).toBeNull();
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('asks the API again as soon as the interval it was given has passed', async () => {
    const { source, fetchImpl, configure, advance } = setup(
      () => playing('105600'),
      1_000,
    );
    configure();
    await source();

    advance(1_500);
    await source();

    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("does not take one account's game for another's", async () => {
    const { source, fetchImpl, configure, store } = setup(() =>
      playing('105600'),
    );
    configure();
    await source();

    store.setCredentials(
      { steamId: OTHER_STEAM_ID, apiKey: KEY },
      { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' },
    );
    await source();

    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('keeps the last answer when the API fails', async () => {
    let fail = false;
    const { source, configure, advance } = setup(() =>
      fail ? { status: 500, text: 'down' } : playing('105600'),
    );
    configure();
    expect(await source()).toBe(105600);

    fail = true;
    advance(31_000);
    expect(await source()).toBe(105600);
  });
});
