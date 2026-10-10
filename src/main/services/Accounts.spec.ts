import { describe, expect, it } from 'vitest';

import { type CurrentGame } from '@shared/types/Game';
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
import { type Store } from '../storage/Store';

import { AccountFollower } from './AccountFollower';
import { Accounts } from './Accounts';
import { GameWatcher } from './GameWatcher';
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
  /** What happens in the app while Steam is being asked about a key. */
  whileSteamAnswers?: (store: Store) => void;
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
  whileSteamAnswers = () => {},
}: ISetupOptions = {}) {
  const store = makeDiskStore();
  for (const steamId of [...saved].reverse()) {
    store.setCredentials(
      { steamId, apiKey: KEY },
      { steamId, name: 'player', avatar: 'x' },
    );
  }
  const steam = fakeFetch(routes);
  const accountSetup = new SetupService(
    store,
    new SteamClient((input, init) => {
      whileSteamAnswers(store);
      return steam(input, init);
    }),
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

/** The game each account played last, as its library would say. */
const LAST_PLAYED: Record<string, number> = {
  [STEAM_ID]: 7,
  [OTHER_STEAM_ID]: 9,
};

/**
 * The app as `index.ts` wires it, following `STEAM_ID`, its only account:
 * the real setup, follower and watcher over a store on disk. Only the edges
 * are fake: Steam's answers, who is signed in to the client (`signedIn`),
 * the running game (`run`) and each account's library (`LAST_PLAYED`).
 */
function setupWired(signedIn: string) {
  const store = makeDiskStore();
  store.setCredentials(
    { steamId: STEAM_ID, apiKey: KEY },
    { steamId: STEAM_ID, name: 'player', avatar: 'x' },
  );
  const accountSetup = new SetupService(
    store,
    new SteamClient(
      fakeFetch({
        GetPlayerSummaries: (url) =>
          url.searchParams.get('key') === KEY ? summary(url) : FORBIDDEN_HTML,
      }),
    ),
  );
  /** Every account the app was said to have started following. */
  const followed: string[] = [];
  const follower = new AccountFollower({
    getSignedInSteamId: () => Promise.resolve(signedIn),
    store,
    onFollow: (steamId) => followed.push(steamId),
  });
  let running: number | null = null;
  /** Every current game the interface was told about. */
  const announced: CurrentGame[] = [];
  const watcher = new GameWatcher({
    getRunningAppId: () => Promise.resolve(running),
    lastPlayedAppId: () =>
      Promise.resolve(LAST_PLAYED[store.getActiveSteamId() ?? ''] ?? null),
    followRunningGame: () => follower.forRunningGame(),
    pollGame: () => Promise.resolve({ ok: false, error: 'not read here' }),
    isConfigured: () => accountSetup.isConfigured,
    onCurrentChanged: (current) => announced.push(current),
    onGameUpdated: () => {},
  });
  // An add does not wait for the check it starts; a test has to.
  let lastCheck = Promise.resolve();
  const sut = new Accounts({
    setup: accountSetup,
    follower,
    watcher: {
      get isPlaying() {
        return watcher.isPlaying;
      },
      forget: (options) => watcher.forget(options),
      checkRunningGame: () => (lastCheck = watcher.checkRunningGame()),
    },
  });
  return {
    sut,
    store,
    watcher,
    announced,
    followed,
    checked: () => lastCheck,
    /** A game starts or closes on Steam, and the watcher's next check sees it. */
    run: (appid: number | null) => {
      running = appid;
      return watcher.checkRunningGame();
    },
  };
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

    it('should forget the game on screen before it checks the running game when the added account takes over', async () => {
      const { sut, asked } = setup();

      await sut.add(UNKNOWN_STEAM_ID, OTHER_KEY);

      expect(asked).toEqual([
        `forget the game on screen, on ${UNKNOWN_STEAM_ID}`,
        `check the running game, on ${UNKNOWN_STEAM_ID}`,
      ]);
    });

    it('should check the running game and forget nothing when the add is refused with the app set up', async () => {
      const { sut, asked } = setup();

      const state = await sut.add(OTHER_STEAM_ID, OTHER_KEY);

      expect(state.activeSteamId).toBe(STEAM_ID);
      expect(asked).toEqual([`check the running game, on ${STEAM_ID}`]);
    });

    it('should forget nothing when the app followed a saved account while Steam refused the one being added', async () => {
      const { sut, asked } = setup({
        routes: { GetPlayerSummaries: FORBIDDEN_HTML },
        whileSteamAnswers: (store) => store.setActiveAccount(OTHER_STEAM_ID),
      });

      const state = await sut.add(UNKNOWN_STEAM_ID, OTHER_KEY);

      expect(state.activeSteamId).toBe(OTHER_STEAM_ID);
      expect(asked).toEqual([`check the running game, on ${OTHER_STEAM_ID}`]);
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

  describe('add, with the real watcher and follower', () => {
    it("should show the running game as the added account's when it was on that account, which the app did not have", async () => {
      const { sut, watcher, announced, checked, run } =
        setupWired(OTHER_STEAM_ID);
      await run(42);

      await sut.add(OTHER_STEAM_ID, KEY);
      await checked();
      const current = await watcher.refreshCurrent();

      expect(current).toEqual({ appid: 42, isRunning: true });
      expect(announced).toEqual([
        { appid: 42, isRunning: true, isOnAnotherAccount: true },
        { appid: 42, isRunning: true },
      ]);
    });

    it('should show the game the added account played last when the account that was left had closed another', async () => {
      const { sut, watcher, announced, checked, run } = setupWired(STEAM_ID);
      await run(42);
      await run(null);

      await sut.add(OTHER_STEAM_ID, KEY);
      await checked();
      const current = await watcher.refreshCurrent();

      expect(current).toEqual({ appid: 9, isRunning: false });
      expect(announced).toEqual([
        { appid: 42, isRunning: true },
        { appid: 42, isRunning: false },
        { appid: 9, isRunning: false },
      ]);
    });

    it('should go back to the account that is playing when another is added while its game runs', async () => {
      const { sut, store, followed, checked, run } = setupWired(STEAM_ID);
      await run(42);

      await sut.add(OTHER_STEAM_ID, KEY);
      await checked();

      expect(store.getActiveSteamId()).toBe(STEAM_ID);
      expect(followed).toEqual([STEAM_ID]);
    });

    it('should keep saying the game is on another account when Steam refuses the key of the account being added', async () => {
      const { sut, watcher, announced, checked, run } =
        setupWired(OTHER_STEAM_ID);
      await run(42);

      await sut.add(OTHER_STEAM_ID, OTHER_KEY);
      await checked();
      const current = await watcher.refreshCurrent();

      expect(current).toEqual({
        appid: 42,
        isRunning: true,
        isOnAnotherAccount: true,
      });
      expect(announced).toEqual([
        { appid: 42, isRunning: true, isOnAnotherAccount: true },
      ]);
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
