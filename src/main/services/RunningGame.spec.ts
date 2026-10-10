import { describe, expect, it } from 'vitest';

import {
  fakeFetch,
  type IRoute,
  KEY,
  makeDiskStore,
  OTHER_STEAM_ID,
  STEAM_ID,
  UNKNOWN_STEAM_ID,
} from '@tests/helpers';

import { SteamClient } from '../steam/SteamClient';
import { type ISteamLocal } from '../steam/SteamLocal';

import { RunningGame } from './RunningGame';

const HALF_A_MINUTE = 30_000;

interface ISetupOverrides {
  /** What `GetPlayerSummaries` answers; by default, a profile in a game. */
  summary?: (url: URL) => IRoute;
  local?: Partial<ISteamLocal>;
  interval?: number;
}

const playing = (gameid?: string): IRoute => ({
  json: {
    response: {
      players: [
        { steamid: STEAM_ID, personaname: 'j', avatarfull: '', gameid },
      ],
    },
  },
});

/** A system with no registry, no account in the app and nobody signed in. */
function setup({
  summary = () => playing('105600'),
  local,
  interval,
}: ISetupOverrides = {}) {
  const store = makeDiskStore();
  const fetchImpl = fakeFetch({ GetPlayerSummaries: summary });
  let now = 0;
  let signedIn: string | null = null;
  const sut = new RunningGame({
    local: {
      canTrackRunningGame: false,
      getRunningAppId: () => Promise.resolve(null),
      getActiveSteamId: () => Promise.resolve(signedIn),
      readStatMap: () => Promise.resolve(new Map()),
      ...local,
    },
    client: new SteamClient(fetchImpl),
    store,
    now: () => now,
    interval,
  });
  return {
    sut,
    fetchImpl,
    /** Saves an account in the app and puts the app on it. */
    configure: (steamId = STEAM_ID) => {
      store.setCredentials(
        { steamId, apiKey: KEY },
        { steamId, name: 'player', avatar: '' },
      );
    },
    advance: (ms: number) => {
      now += ms;
    },
    signIn: (steamId: string | null) => {
      signedIn = steamId;
    },
  };
}

describe('RunningGame', () => {
  it('should answer the game in the registry without asking the API when the system has one', async () => {
    const { sut, fetchImpl, configure } = setup({
      local: {
        canTrackRunningGame: true,
        getRunningAppId: () => Promise.resolve(42),
      },
    });
    configure();

    const appId = await sut.getAppId();

    expect(appId).toBe(42);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('should answer null without asking the API when no account is configured', async () => {
    const { sut, fetchImpl } = setup();

    const appId = await sut.getAppId();

    expect(appId).toBeNull();
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('should answer the game shown in the profile when an account is configured', async () => {
    const { sut, configure } = setup();
    configure();

    const appId = await sut.getAppId();

    expect(appId).toBe(105600);
  });

  it('should reuse the answer when asked again within half a minute', async () => {
    let game: string | undefined = '105600';
    const { sut, fetchImpl, configure, advance } = setup({
      summary: () => playing(game),
    });
    configure();
    await sut.getAppId();
    game = undefined;
    advance(HALF_A_MINUTE - 1);

    const appId = await sut.getAppId();

    expect(appId).toBe(105600);
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it('should ask the API again when half a minute has passed', async () => {
    let game: string | undefined = '105600';
    const { sut, fetchImpl, configure, advance } = setup({
      summary: () => playing(game),
    });
    configure();
    await sut.getAppId();
    game = undefined;
    advance(HALF_A_MINUTE);

    const appId = await sut.getAppId();

    expect(appId).toBeNull();
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('should ask the API again when the interval it was given has passed', async () => {
    const { sut, fetchImpl, configure, advance } = setup({ interval: 1_000 });
    configure();
    await sut.getAppId();
    advance(1_000);

    await sut.getAppId();

    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("should not answer one account's game when asked about another", async () => {
    const { sut, configure } = setup({
      summary: (url) =>
        url.searchParams.get('steamids') === OTHER_STEAM_ID
          ? { status: 500, text: 'down' }
          : playing('105600'),
    });
    configure();
    await sut.getAppId();
    configure(OTHER_STEAM_ID);

    const appId = await sut.getAppId();

    expect(appId).toBeNull();
  });

  it('should ask about the account signed in to Steam when the app has it', async () => {
    const { sut, fetchImpl, configure, signIn } = setup();
    configure();
    configure(OTHER_STEAM_ID);
    signIn(STEAM_ID);

    await sut.getAppId();

    expect(fetchImpl.calls).toEqual([
      expect.stringContaining(`steamids=${STEAM_ID}`),
    ]);
  });

  it('should ask about the account in use when the one signed in to Steam is not in the app', async () => {
    const { sut, fetchImpl, configure, signIn } = setup();
    configure();
    signIn(UNKNOWN_STEAM_ID);

    await sut.getAppId();

    expect(fetchImpl.calls).toEqual([
      expect.stringContaining(`steamids=${STEAM_ID}`),
    ]);
  });

  it('should keep the last answer when the API fails', async () => {
    let isFailing = false;
    const { sut, configure, advance } = setup({
      summary: () =>
        isFailing ? { status: 500, text: 'down' } : playing('105600'),
    });
    configure();
    await sut.getAppId();
    isFailing = true;
    advance(HALF_A_MINUTE);

    const appId = await sut.getAppId();

    expect(appId).toBe(105600);
  });
});
