import { describe, expect, it } from 'vitest';

import {
  fakeFetch,
  FORBIDDEN_HTML,
  KEY,
  makeDiskStore,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
  UNKNOWN_STEAM_ID,
} from '@tests/helpers';

import { SteamClient } from '../steam/SteamClient';

import { Accounts } from './Accounts';
import { SetupService } from './SetupService';

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

interface ISetupOptions {
  /** The accounts the app starts with; it follows the first. */
  saved?: string[];
  /** Whether a game of the account in use is running. */
  isPlaying?: boolean;
  /** Whether the Steam client's account makes the app switch. */
  hasClientSwitched?: boolean;
  routes?: Parameters<typeof fakeFetch>[0];
}

/**
 * The app with two accounts, following `STEAM_ID`, over a watcher that only
 * writes down what it was asked and the account in use at that moment.
 */
function setup({
  saved = [STEAM_ID, OTHER_STEAM_ID],
  isPlaying = false,
  hasClientSwitched = false,
  routes = { GetPlayerSummaries: summary },
}: ISetupOptions = {}) {
  const store = makeDiskStore();
  for (const steamId of [...saved].reverse()) {
    store.setCredentials(
      { steamId, apiKey: KEY },
      { steamId, name: 'player', avatar: 'x' },
    );
  }
  const accountSetup = new SetupService(
    store,
    new SteamClient(fakeFetch(routes)),
  );
  /** What the watcher was asked, in order. */
  const asked: string[] = [];
  const inUse = (): string => store.getActiveSteamId() ?? 'no account';
  const sut = new Accounts({
    setup: accountSetup,
    follower: { onClientChange: () => Promise.resolve(hasClientSwitched) },
    watcher: {
      isPlaying,
      forget: ({ isCurrentIncluded = false } = {}) => {
        const what = isCurrentIncluded ? 'the game on screen' : 'the view';
        asked.push(`forget ${what}, on ${inUse()}`);
      },
      checkRunningGame: () => {
        asked.push(`check the running game, on ${inUse()}`);
        return Promise.resolve();
      },
    },
  });
  return { sut, asked, state: () => accountSetup.getState() };
}

describe('Accounts', () => {
  describe('add', () => {
    it('should follow the added account when Steam accepts its key', async () => {
      const { sut } = setup();

      const state = await sut.add(UNKNOWN_STEAM_ID, OTHER_KEY);

      expect(state.activeSteamId).toBe(UNKNOWN_STEAM_ID);
      expect(state.accounts.map((account) => account.steamId)).toEqual([
        OTHER_STEAM_ID,
        STEAM_ID,
        UNKNOWN_STEAM_ID,
      ]);
    });

    it('should check the running game on the added account when the add leaves the app set up', async () => {
      const { sut, asked } = setup();

      await sut.add(UNKNOWN_STEAM_ID, OTHER_KEY);

      expect(asked).toContain(`check the running game, on ${UNKNOWN_STEAM_ID}`);
    });

    it('should not forget the game of the account that was left when an account is added', async () => {
      const { sut, asked } = setup();

      await sut.add(UNKNOWN_STEAM_ID, OTHER_KEY);

      expect(asked.filter((ask) => ask.startsWith('forget'))).toEqual([]);
    });

    it('should check the running game on the account in use when the add is refused with the app set up', async () => {
      const { sut, asked } = setup();

      const state = await sut.add(OTHER_STEAM_ID, OTHER_KEY);

      expect(state.activeSteamId).toBe(STEAM_ID);
      expect(asked).toEqual([`check the running game, on ${STEAM_ID}`]);
    });

    it('should ask nothing of the watcher when the add leaves the app without an account', async () => {
      const { sut, asked } = setup({
        saved: [],
        routes: { GetPlayerSummaries: FORBIDDEN_HTML },
      });

      const state = await sut.add(STEAM_ID, KEY);

      expect(state.isConfigured).toBe(false);
      expect(asked).toEqual([]);
    });
  });

  describe('switchTo', () => {
    it('should forget the game on screen before it switches when no game is being played', () => {
      const { sut, asked } = setup();

      const state = sut.switchTo(OTHER_STEAM_ID);

      expect(state.activeSteamId).toBe(OTHER_STEAM_ID);
      expect(asked).toEqual([`forget the game on screen, on ${STEAM_ID}`]);
    });

    it('should stay on the account and forget nothing when a game is being played', () => {
      const { sut, asked, state: stateNow } = setup({ isPlaying: true });
      const before = stateNow();

      const state = sut.switchTo(OTHER_STEAM_ID);

      expect(state).toEqual(before);
      expect(asked).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should forget the game on screen before it removes the account', () => {
      const { sut, asked } = setup();

      const state = sut.remove(STEAM_ID);

      expect(state.activeSteamId).toBe(OTHER_STEAM_ID);
      expect(state.accounts.map((account) => account.steamId)).toEqual([
        OTHER_STEAM_ID,
      ]);
      expect(asked).toEqual([`forget the game on screen, on ${STEAM_ID}`]);
    });
  });

  describe('followClient', () => {
    it("should forget the game on screen when the client's account made the app switch", async () => {
      const { sut, asked } = setup({ hasClientSwitched: true });

      await sut.followClient();

      expect(asked).toEqual([`forget the game on screen, on ${STEAM_ID}`]);
    });

    it("should forget nothing when the client's account did not make the app switch", async () => {
      const { sut, asked } = setup({ hasClientSwitched: false });

      await sut.followClient();

      expect(asked).toEqual([]);
    });
  });
});
