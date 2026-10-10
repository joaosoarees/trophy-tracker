import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppState } from '@shared/types/AppState';
import { type CurrentGame } from '@shared/types/Game';
import { makeAppState } from '@tests/factories/makeAppState';
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

/** One turn of the event loop: whatever was ready to run has run. */
const turn = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

/**
 * The store wired for the first account, which asks for its current game as
 * it is wired, over a main process that answers it when the test says so:
 * `asked` holds one answer per request, in the order they were made.
 */
async function setup() {
  const asked: ReturnType<typeof deferred<CurrentGame>>[] = [];
  const api: Partial<IApi> = {
    getCurrentAppId: () => {
      const answer = deferred<CurrentGame>();
      asked.push(answer);
      return answer.promise;
    },
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

describe('sessionSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('loadCurrent', () => {
    it('should show the last played game when it is answered while its account is still in use', async () => {
      const { sut, asked } = await setup();
      asked[0].resolve({ appid: 7, isRunning: false });

      await turn();

      expect(sut.getState().session.current).toEqual({
        appid: 7,
        isRunning: false,
      });
    });

    it('should not show the last played game of the account that was left when it is answered after another took over', async () => {
      const { sut, asked, follow } = await setup();
      follow(otherAccountState());
      asked[0].resolve({ appid: 7, isRunning: false });

      await turn();

      expect(sut.getState().session.current).toBeNull();
    });
  });
});
