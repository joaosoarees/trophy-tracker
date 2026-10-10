import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';
import { type IGameView } from '@shared/types/Game';
import { makeAppState } from '@tests/factories/makeAppState';
import { makeGameView } from '@tests/factories/makeGameView';
import { OTHER_STEAM_ID } from '@tests/helpers';
import { deferred, makeAppStore } from '@tests/makeAppStore';

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

/**
 * The store wired for the first account, over a main process that answers
 * about a game when the test says so: `asked` holds a game read per request,
 * in the order they were made.
 */
async function setup() {
  const asked: ReturnType<typeof deferred<CheckResult<IGameView>>>[] = [];
  const api: Partial<IApi> = {
    getGame: () => {
      const answer = deferred<CheckResult<IGameView>>();
      asked.push(answer);
      return answer.promise;
    },
    getCurrentAppId: () => Promise.resolve(null),
    getDashboard: () => Promise.resolve({ ok: true, value: [] }),
    onStateChanged: () => () => {},
    onGameChanged: () => () => {},
    onGameUpdated: () => () => {},
    onDashboardProgress: () => () => {},
  };
  const made = await makeAppStore({ api });
  made.follow(makeAppState());
  return { ...made, asked };
}

describe('gamesSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('load', () => {
    it('should show the game when it is read while its account is still in use', async () => {
      const { sut, asked } = await setup();
      const loading = sut.getState().games.load(10);
      asked[0].resolve({ ok: true, value: makeGameView({ appid: 10 }) });

      await loading;

      expect(sut.getState().games.entries[10]).toEqual({
        view: makeGameView({ appid: 10 }),
        isLoading: false,
        error: null,
        justUnlocked: [],
      });
    });

    it('should show the failure when the read fails while its account is still in use', async () => {
      const { sut, asked } = await setup();
      const loading = sut.getState().games.load(10);
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });

      await loading;

      expect(sut.getState().games.entries[10]).toEqual({
        view: null,
        isLoading: false,
        error: 'Steam did not answer.',
        justUnlocked: [],
      });
    });

    it('should not show a game to the account in use when it was read for the one that was left', async () => {
      const { sut, asked, follow } = await setup();
      const loading = sut.getState().games.load(10);
      follow(otherAccountState());
      asked[0].resolve({ ok: true, value: makeGameView({ appid: 10 }) });

      await loading;

      expect(sut.getState().games.entries).toEqual({});
    });

    it('should show no failure to the account in use when the read that failed was for the one that was left', async () => {
      const { sut, asked, follow } = await setup();
      const loading = sut.getState().games.load(10);
      follow(otherAccountState());
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });

      await loading;

      expect(sut.getState().games.entries).toEqual({});
    });

    it('should show the failure when its account was left and followed again before the read failed', async () => {
      const { sut, asked, follow } = await setup();
      const loading = sut.getState().games.load(10);
      follow(otherAccountState());
      follow(makeAppState());
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });

      await loading;

      expect(sut.getState().games.entries[10]).toEqual({
        view: null,
        isLoading: false,
        error: 'Steam did not answer.',
        justUnlocked: [],
      });
    });
  });
});
