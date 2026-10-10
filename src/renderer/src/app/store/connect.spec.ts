import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppState } from '@shared/types/AppState';
import { makeAchievement } from '@tests/factories/makeAchievement';
import { makeAppState } from '@tests/factories/makeAppState';
import { makeGameSummary } from '@tests/factories/makeGameSummary';
import { makeGameView } from '@tests/factories/makeGameView';
import { OTHER_STEAM_ID, STEAM_ID } from '@tests/helpers';
import { makeAppStore } from '@tests/makeAppStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

/** The state of the app following the second account. */
function otherAccountState(): IAppState {
  return makeAppState({
    activeSteamId: OTHER_STEAM_ID,
    profile: { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' },
  });
}

/** One turn of the event loop: whatever was ready to run has run. */
const turn = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

/** The events of the main process, each with whoever listens to it now. */
type Listening = {
  [
    K in
      | 'onStateChanged'
      | 'onGameChanged'
      | 'onGameUpdated'
      | 'onDashboardProgress'
  ]?: Parameters<IApi[K]>[0];
};

/**
 * The store on the first account and `sut`, which wires it, over a main
 * process that has one game on the dashboard, no current game and the note
 * "saved" on achievement A of every game. `listening` holds who listens to
 * each of its events, `saved` every write of user data it was asked for.
 */
async function setup() {
  const listening: Listening = {};
  const saved: Parameters<IApi['setUserData']>[] = [];
  const api: Partial<IApi> = {
    getCurrentAppId: () => Promise.resolve(null),
    getDashboard: () =>
      Promise.resolve({ ok: true, value: [makeGameSummary({ appid: 10 })] }),
    getUserData: () => Promise.resolve({ A: { note: 'saved', pinned: false } }),
    setUserData: (...write) => {
      saved.push(write);
      return Promise.resolve();
    },
    onStateChanged: (listener) => {
      listening.onStateChanged = listener;
      return () => delete listening.onStateChanged;
    },
    onGameChanged: (listener) => {
      listening.onGameChanged = listener;
      return () => delete listening.onGameChanged;
    },
    onGameUpdated: (listener) => {
      listening.onGameUpdated = listener;
      return () => delete listening.onGameUpdated;
    },
    onDashboardProgress: (listener) => {
      listening.onDashboardProgress = listener;
      return () => delete listening.onDashboardProgress;
    },
  };
  const { sut: store, fireWindowEvent } = await makeAppStore({ api });
  store.getState().settings.apply(makeAppState());
  // Loaded after the store was made, so it is the store this one wires.
  const { connectStore: sut } = await import('./connect');
  return { sut, store, listening, saved, fireWindowEvent };
}

describe('connectStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('while wired', () => {
    it('should take the state when the main process sends one by itself', async () => {
      const { sut, store, listening } = await setup();
      sut();

      listening.onStateChanged?.(otherAccountState(), false);

      expect(store.getState().settings.appState).toEqual(otherAccountState());
    });

    it('should show the game when the main process says another one is current', async () => {
      const { sut, store, listening } = await setup();
      sut();
      await turn();

      listening.onGameChanged?.({ appid: 7, isRunning: true });

      expect(store.getState().session.current).toEqual({
        appid: 7,
        isRunning: true,
      });
    });

    it('should take the game when the main process read it again', async () => {
      const { sut, store, listening } = await setup();
      sut();

      listening.onGameUpdated?.(makeGameView({ appid: 10 }));

      expect(store.getState().games.entries[10]).toEqual({
        view: makeGameView({ appid: 10 }),
        isLoading: false,
        error: null,
        justUnlocked: [],
      });
    });

    it('should show how far the dashboard is when the main process reports it', async () => {
      const { sut, store, listening } = await setup();
      sut();

      listening.onDashboardProgress?.(3, 10);

      expect(store.getState().dashboard.progress).toEqual([3, 10]);
    });

    it('should write the edit that was waiting when the window is closing', async () => {
      const { sut, store, saved, fireWindowEvent } = await setup();
      sut();
      store.getState().userData.update(10, 'A', { note: 'typed just now' });

      fireWindowEvent('beforeunload');

      expect(saved).toEqual([
        [10, 'A', { note: 'typed just now', pinned: false }, STEAM_ID],
      ]);
    });
  });

  describe('when unwired', () => {
    it('should listen to no event of the main process any more', async () => {
      const { sut, listening } = await setup();
      const disconnect = sut();

      disconnect();

      expect(listening).toEqual({});
    });

    it('should write the edit that was waiting', async () => {
      const { sut, store, saved } = await setup();
      const disconnect = sut();
      store.getState().userData.update(10, 'A', { note: 'typed just now' });

      disconnect();

      expect(saved).toEqual([
        [10, 'A', { note: 'typed just now', pinned: false }, STEAM_ID],
      ]);
    });

    it('should drop the games that were read', async () => {
      const { sut, store } = await setup();
      const disconnect = sut();
      store
        .getState()
        .games.accept(
          makeGameView({ appid: 10, achievements: [makeAchievement()] }),
        );

      disconnect();

      expect(store.getState().games.entries).toEqual({});
    });

    it('should drop the notes that were read', async () => {
      const { sut, store } = await setup();
      const disconnect = sut();
      await store.getState().userData.load(10);

      disconnect();

      expect(store.getState().userData.byGame).toEqual({});
    });

    it('should drop the dashboard that was read', async () => {
      const { sut, store } = await setup();
      const disconnect = sut();
      await turn();
      store.getState().dashboard.setProgress(3, 10);

      disconnect();

      const { games, isLoading, error, progress } = store.getState().dashboard;
      expect({ games, isLoading, error, progress }).toEqual({
        games: null,
        isLoading: false,
        error: null,
        progress: null,
      });
    });

    it('should drop the current game', async () => {
      const { sut, store } = await setup();
      const disconnect = sut();
      await turn();
      store.getState().session.setCurrent({ appid: 7, isRunning: false });

      disconnect();

      expect(store.getState().session.current).toBeNull();
    });

    it('should forget the game picked in the dashboard', async () => {
      const { sut, store } = await setup();
      const disconnect = sut();
      store.getState().navigation.pickGame(10);

      disconnect();

      expect(store.getState().navigation.pickedAppId).toBeNull();
    });

    it('should keep the language of the interface', async () => {
      const { sut, store } = await setup();
      const disconnect = sut();
      store.getState().session.setLanguage('fr');

      disconnect();

      expect(store.getState().session.language).toBe('fr');
    });

    it('should keep the state of the setup', async () => {
      const { sut, store } = await setup();
      const disconnect = sut();

      disconnect();

      expect(store.getState().settings.appState).toEqual(makeAppState());
    });
  });
});
