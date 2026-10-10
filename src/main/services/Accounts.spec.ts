import { describe, expect, it } from 'vitest';

import { type CurrentGame } from '@shared/types/Game';
import { fakeSteamClient } from '@tests/fakeSteamClient';
import {
  KEY,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
  UNKNOWN_STEAM_ID,
} from '@tests/helpers';
import { InMemoryStore } from '@tests/InMemoryStore';

import {
  type ICredentials,
  type IRawPlayerSummary,
  SteamError,
} from '../steam/SteamClient';

import { AccountChecks } from './AccountChecks';
import { AccountFollower } from './AccountFollower';
import { Accounts } from './Accounts';
import { GameWatcher } from './GameWatcher';
import { KeyStatus } from './KeyStatus';
import { SetupService } from './SetupService';

/** Steam knows whoever is asked about, and calls them "player". */
const summary = ({ steamId }: ICredentials): IRawPlayerSummary => ({
  steamid: steamId,
  personaname: 'player',
  avatarfull: 'x',
});

const KEY_REJECTED = 'Steam rejected the Web API key.';
const ALREADY_ADDED =
  'This account was already added. To change its key, use “Replace key” in Settings.';

/** Steam rejecting the key it was asked with. */
const rejected = (): never => {
  throw new SteamError('invalid-key');
};

interface ISetupOptions {
  /** The accounts the app starts with; it follows the first. */
  saved?: string[];
  /** Whether a game of the account in use is running. */
  isPlaying?: boolean;
  /** Whether the Steam client's account makes the app switch. */
  hasClientSwitched?: boolean;
  /** What Steam answers about the profile of an account; by default, it knows it. */
  profileOf?: (credentials: ICredentials) => IRawPlayerSummary;
  /** What happens in the app while Steam is being asked about a key. */
  whileSteamAnswers?: (store: InMemoryStore) => void;
}

/**
 * The app with two accounts, following `STEAM_ID`, over a watcher that only
 * writes down what it was asked and the account in use at that moment. The
 * setup is the real one, over a store in memory and a Steam that answers
 * what it is given.
 */
function setup({
  saved = [STEAM_ID, OTHER_STEAM_ID],
  isPlaying = false,
  hasClientSwitched = false,
  profileOf = summary,
  whileSteamAnswers = () => {},
}: ISetupOptions = {}) {
  const store = new InMemoryStore();
  for (const steamId of [...saved].reverse()) {
    store.setCredentials(
      { steamId, apiKey: KEY },
      { steamId, name: 'player', avatar: 'x' },
    );
  }
  const client = fakeSteamClient({
    summary: (credentials) => {
      whileSteamAnswers(store);
      return profileOf(credentials);
    },
  });
  const keys = new KeyStatus(store, client);
  const accountSetup = new SetupService(
    store,
    new AccountChecks(store, client, keys),
    keys,
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
  return { sut, store, asked, state: () => accountSetup.getState() };
}

const WRITE_REFUSED = new Error('InMemoryStore: the write was refused');

/** What a call that must throw threw, or `null` when it did not. */
function thrownBy(call: () => unknown): unknown {
  try {
    call();
    return null;
  } catch (e) {
    return e;
  }
}

/** The game each account played last, as its library would say. */
const LAST_PLAYED: Record<string, number> = {
  [STEAM_ID]: 7,
  [OTHER_STEAM_ID]: 9,
};

/**
 * The app as `index.ts` wires it, following `STEAM_ID`, its only account:
 * the real setup, follower and watcher. Only the edges are fake: the store,
 * which is in memory, Steam's answers, who is signed in to the client
 * (`signedIn`), the running game (`run`) and each account's library
 * (`LAST_PLAYED`). Steam accepts `KEY` and no other.
 */
function setupWired(signedIn: string) {
  const store = new InMemoryStore();
  store.setCredentials(
    { steamId: STEAM_ID, apiKey: KEY },
    { steamId: STEAM_ID, name: 'player', avatar: 'x' },
  );
  const client = fakeSteamClient({
    summary: (credentials) =>
      credentials.apiKey === KEY ? summary(credentials) : rejected(),
  });
  const keys = new KeyStatus(store, client);
  const accountSetup = new SetupService(
    store,
    new AccountChecks(store, client, keys),
    keys,
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

/**
 * The app with two accounts, following `STEAM_ID`, and a Steam client signed
 * in to the other one: the real follower over a store in memory, which the
 * test makes refuse what is written (`store.refuseWrites`). `asked` is what
 * the watcher was asked and `logged` what reached the error log; `signIn`
 * changes who is signed in to the client.
 */
function setupFollowing() {
  let signedIn = OTHER_STEAM_ID;
  const store = new InMemoryStore();
  for (const steamId of [OTHER_STEAM_ID, STEAM_ID]) {
    store.setCredentials(
      { steamId, apiKey: KEY },
      { steamId, name: 'player', avatar: 'x' },
    );
  }
  const client = fakeSteamClient({ summary });
  const keys = new KeyStatus(store, client);
  const asked: string[] = [];
  const logged: { source: string; detail: string }[] = [];
  const sut = new Accounts({
    setup: new SetupService(
      store,
      new AccountChecks(store, client, keys),
      keys,
    ),
    follower: new AccountFollower({
      getSignedInSteamId: () => Promise.resolve(signedIn),
      store,
      onFollow: () => {},
    }),
    watcher: {
      isPlaying: false,
      forget: () => asked.push('forget the game on screen'),
      checkRunningGame: () => Promise.resolve(),
    },
    logError: (source, detail) => logged.push({ source, detail }),
  });
  const signIn = (steamId: string): void => {
    signedIn = steamId;
  };
  return { sut, store, asked, logged, signIn };
}

describe('Accounts', () => {
  describe('add', () => {
    it('should follow the added account when Steam accepts its key', async () => {
      const { sut } = setup();

      const result = await sut.add(UNKNOWN_STEAM_ID, OTHER_KEY);

      expect(result).toMatchObject({
        ok: true,
        value: {
          activeSteamId: UNKNOWN_STEAM_ID,
          accounts: [
            { steamId: OTHER_STEAM_ID },
            { steamId: STEAM_ID },
            { steamId: UNKNOWN_STEAM_ID },
          ],
        },
      });
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
      const { sut, asked, state } = setup();

      const result = await sut.add(OTHER_STEAM_ID, OTHER_KEY);

      expect(result).toEqual({ ok: false, error: ALREADY_ADDED });
      expect(state().activeSteamId).toBe(STEAM_ID);
      expect(asked).toEqual([`check the running game, on ${STEAM_ID}`]);
    });

    it('should forget nothing when the app followed a saved account while Steam refused the one being added', async () => {
      const { sut, asked, state } = setup({
        profileOf: rejected,
        whileSteamAnswers: (store) => store.setActiveAccount(OTHER_STEAM_ID),
      });

      const result = await sut.add(UNKNOWN_STEAM_ID, OTHER_KEY);

      expect(result).toEqual({ ok: false, error: KEY_REJECTED });
      expect(state().activeSteamId).toBe(OTHER_STEAM_ID);
      expect(asked).toEqual([`check the running game, on ${OTHER_STEAM_ID}`]);
    });

    it('should ask nothing of the watcher when the add leaves the app without an account', async () => {
      const { sut, asked, state } = setup({
        saved: [],
        profileOf: rejected,
      });

      const result = await sut.add(STEAM_ID, KEY);

      expect(result).toEqual({ ok: false, error: KEY_REJECTED });
      expect(state().isConfigured).toBe(false);
      expect(asked).toEqual([]);
    });
  });

  describe('add, when the account cannot be written', () => {
    it('should say so, save nothing and ask nothing of the watcher', async () => {
      const { sut, store, asked, state } = setup({ saved: [STEAM_ID] });
      store.refuseWrites();

      const failure = await sut
        .add(OTHER_STEAM_ID, OTHER_KEY)
        .catch((e: unknown) => e);

      expect(failure).toEqual(WRITE_REFUSED);
      expect(state().accounts.map((account) => account.steamId)).toEqual([
        STEAM_ID,
      ]);
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
    it('should forget the game on screen as it switches when no game is being played', () => {
      const { sut, asked } = setup();

      const state = sut.switchTo(OTHER_STEAM_ID);

      expect(state.activeSteamId).toBe(OTHER_STEAM_ID);
      expect(asked).toEqual([
        `forget the game on screen, on ${OTHER_STEAM_ID}`,
      ]);
    });

    it('should say so, stay on the account and forget nothing when the switch cannot be written', () => {
      const { sut, store, asked, state } = setup();
      store.refuseWrites();

      const failure = thrownBy(() => sut.switchTo(OTHER_STEAM_ID));

      expect(failure).toEqual(WRITE_REFUSED);
      expect(state().activeSteamId).toBe(STEAM_ID);
      expect(asked).toEqual([]);
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
    it('should forget the game on screen as it removes the account', () => {
      const { sut, asked } = setup();

      const state = sut.remove(STEAM_ID);

      expect(state.activeSteamId).toBe(OTHER_STEAM_ID);
      expect(state.accounts.map((account) => account.steamId)).toEqual([
        OTHER_STEAM_ID,
      ]);
      expect(asked).toEqual([
        `forget the game on screen, on ${OTHER_STEAM_ID}`,
      ]);
    });

    it('should say so, keep the account and forget nothing when the removal cannot be written', () => {
      const { sut, store, asked, state } = setup();
      const before = state();
      store.refuseWrites();

      const failure = thrownBy(() => sut.remove(STEAM_ID));

      expect(failure).toEqual(WRITE_REFUSED);
      expect(state()).toEqual(before);
      expect(asked).toEqual([]);
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

  describe("followClient, when the client's account cannot be written", () => {
    it('should end without failing, on the account it was on, and forget nothing', async () => {
      const { sut, store, asked } = setupFollowing();
      store.refuseWrites();

      const outcome = await sut.followClient().then(
        () => 'ended',
        (e: unknown) => `rejected: ${String(e)}`,
      );

      expect(outcome).toBe('ended');
      expect(store.getActiveSteamId()).toBe(STEAM_ID);
      expect(asked).toEqual([]);
    });

    it('should write the refusal to the error log', async () => {
      const { sut, store, logged } = setupFollowing();
      store.refuseWrites();

      await sut.followClient();

      expect(logged).toEqual([
        {
          source: 'main: follow account',
          detail: expect.stringContaining(WRITE_REFUSED.message) as string,
        },
      ]);
    });

    it('should log it once when look after look is refused', async () => {
      const { sut, store, logged } = setupFollowing();
      store.refuseWrites();
      await sut.followClient();

      await sut.followClient();

      expect(logged).toHaveLength(1);
    });

    it("should follow the client's account at the next look when the disk takes it by then", async () => {
      const { sut, store, asked } = setupFollowing();
      store.refuseWrites();
      await sut.followClient();
      store.refuseWrites(Infinity);

      await sut.followClient();

      expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
      expect(asked).toEqual(['forget the game on screen']);
    });

    it('should log a refusal again when it comes after a look that worked', async () => {
      const { sut, store, logged, signIn } = setupFollowing();
      store.refuseWrites();
      await sut.followClient();
      store.refuseWrites(Infinity);
      await sut.followClient();
      signIn(STEAM_ID);
      store.refuseWrites();

      await sut.followClient();

      expect(logged).toHaveLength(2);
    });
  });
});
