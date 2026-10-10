import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';
import { type IGameSummary } from '@shared/types/Game';
import { makeAppState } from '@tests/factories/makeAppState';
import { makeGameSummary } from '@tests/factories/makeGameSummary';
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
 * The store wired for the first account, which asks for its dashboard as it
 * is wired, over a main process that answers a dashboard when the test says
 * so: `asked` holds one per request, in the order they were made.
 */
async function setup() {
  const asked: ReturnType<typeof deferred<CheckResult<IGameSummary[]>>>[] = [];
  const api: Partial<IApi> = {
    getDashboard: () => {
      const answer = deferred<CheckResult<IGameSummary[]>>();
      asked.push(answer);
      return answer.promise;
    },
    getCurrentAppId: () => Promise.resolve(null),
    onStateChanged: () => () => {},
    onGameChanged: () => () => {},
    onGameUpdated: () => () => {},
    onDashboardProgress: () => () => {},
  };
  const made = await makeAppStore({ api });
  made.follow(makeAppState());
  return { ...made, asked };
}

describe('dashboardSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('load', () => {
    it('should list the games when the dashboard is read while its account is still in use', async () => {
      const { sut, asked } = await setup();
      asked[0].resolve({ ok: true, value: [makeGameSummary({ appid: 10 })] });

      await turn();

      expect(sut.getState().dashboard).toMatchObject({
        games: [makeGameSummary({ appid: 10 })],
        isLoading: false,
        error: null,
      });
    });

    it('should keep waiting for the dashboard of the account in use when the one of the account that was left arrives', async () => {
      const { sut, asked, follow } = await setup();
      follow(otherAccountState());
      asked[0].resolve({ ok: true, value: [makeGameSummary({ appid: 10 })] });

      await turn();

      expect(sut.getState().dashboard).toMatchObject({
        games: null,
        isLoading: true,
        error: null,
      });
    });

    it('should list the games of the account in use when its dashboard arrives after the one of the account that was left', async () => {
      const { sut, asked, follow } = await setup();
      follow(otherAccountState());
      asked[0].resolve({ ok: true, value: [makeGameSummary({ appid: 10 })] });
      asked[1].resolve({ ok: true, value: [makeGameSummary({ appid: 20 })] });

      await turn();

      expect(sut.getState().dashboard).toMatchObject({
        games: [makeGameSummary({ appid: 20 })],
        isLoading: false,
        error: null,
      });
    });
  });
});
