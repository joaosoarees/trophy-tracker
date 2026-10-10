import { describe, expect, it } from 'vitest';

import {
  KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
  UNKNOWN_STEAM_ID,
} from '@tests/helpers';

import {
  type ICredentials,
  type IRawPlayerSummary,
} from '../steam/SteamClient';
import { type ISteamLocal } from '../steam/SteamLocal';

import { RunningGame } from './RunningGame';

const HALF_A_MINUTE = 30_000;

interface ISetupOverrides {
  /**
   * What Steam answers about the profile of an account; by default, a profile
   * in a game. Throwing is Steam failing.
   */
  summary?: (steamId: string) => IRawPlayerSummary;
  local?: Partial<ISteamLocal>;
  interval?: number;
}

const playing = (gameid?: string): IRawPlayerSummary => ({
  steamid: STEAM_ID,
  personaname: 'j',
  avatarfull: '',
  gameid,
});

const down = (): never => {
  throw new Error('Steam is down');
};

/**
 * A system with no registry, no account in the app and nobody signed in. The
 * store and the client are the parts of them `RunningGame` uses, in memory:
 * the store keeps the saved credentials and the account in use, the client
 * writes down in `asked` the SteamID of every profile it was asked about.
 */
function setup({
  summary = () => playing('105600'),
  local,
  interval,
}: ISetupOverrides = {}) {
  const saved = new Map<string, ICredentials>();
  let inUse: string | null = null;
  const asked: string[] = [];
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
    client: {
      getPlayerSummary: ({ steamId }) => {
        asked.push(steamId);
        return Promise.resolve().then(() => summary(steamId));
      },
    },
    store: {
      getCredentials: () => (inUse ? (saved.get(inUse) ?? null) : null),
      getCredentialsOf: (steamId) => saved.get(steamId) ?? null,
    },
    now: () => now,
    interval,
  });
  return {
    sut,
    asked,
    /** Saves an account in the app and puts the app on it. */
    configure: (steamId = STEAM_ID) => {
      saved.set(steamId, { steamId, apiKey: KEY });
      inUse = steamId;
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
    const { sut, asked, configure } = setup({
      local: {
        canTrackRunningGame: true,
        getRunningAppId: () => Promise.resolve(42),
      },
    });
    configure();

    const appId = await sut.getAppId();

    expect(appId).toBe(42);
    expect(asked).toHaveLength(0);
  });

  it('should answer null without asking the API when no account is configured', async () => {
    const { sut, asked } = setup();

    const appId = await sut.getAppId();

    expect(appId).toBeNull();
    expect(asked).toHaveLength(0);
  });

  it('should answer the game shown in the profile when an account is configured', async () => {
    const { sut, configure } = setup();
    configure();

    const appId = await sut.getAppId();

    expect(appId).toBe(105600);
  });

  it('should reuse the answer when asked again within half a minute', async () => {
    let game: string | undefined = '105600';
    const { sut, asked, configure, advance } = setup({
      summary: () => playing(game),
    });
    configure();
    await sut.getAppId();
    game = undefined;
    advance(HALF_A_MINUTE - 1);

    const appId = await sut.getAppId();

    expect(appId).toBe(105600);
    expect(asked).toHaveLength(1);
  });

  it('should ask the API again when half a minute has passed', async () => {
    let game: string | undefined = '105600';
    const { sut, asked, configure, advance } = setup({
      summary: () => playing(game),
    });
    configure();
    await sut.getAppId();
    game = undefined;
    advance(HALF_A_MINUTE);

    const appId = await sut.getAppId();

    expect(appId).toBeNull();
    expect(asked).toHaveLength(2);
  });

  it('should ask the API again when the interval it was given has passed', async () => {
    const { sut, asked, configure, advance } = setup({ interval: 1_000 });
    configure();
    await sut.getAppId();
    advance(1_000);

    await sut.getAppId();

    expect(asked).toHaveLength(2);
  });

  it("should not answer one account's game when asked about another", async () => {
    const { sut, configure } = setup({
      summary: (steamId) =>
        steamId === OTHER_STEAM_ID ? down() : playing('105600'),
    });
    configure();
    await sut.getAppId();
    configure(OTHER_STEAM_ID);

    const appId = await sut.getAppId();

    expect(appId).toBeNull();
  });

  it('should ask about the account signed in to Steam when the app has it', async () => {
    const { sut, asked, configure, signIn } = setup();
    configure();
    configure(OTHER_STEAM_ID);
    signIn(STEAM_ID);

    await sut.getAppId();

    expect(asked).toEqual([STEAM_ID]);
  });

  it('should ask about the account in use when the one signed in to Steam is not in the app', async () => {
    const { sut, asked, configure, signIn } = setup();
    configure();
    signIn(UNKNOWN_STEAM_ID);

    await sut.getAppId();

    expect(asked).toEqual([STEAM_ID]);
  });

  it('should keep the last answer when the API fails', async () => {
    let isFailing = false;
    const { sut, configure, advance } = setup({
      summary: () => (isFailing ? down() : playing('105600')),
    });
    configure();
    await sut.getAppId();
    isFailing = true;
    advance(HALF_A_MINUTE);

    const appId = await sut.getAppId();

    expect(appId).toBe(105600);
  });
});
