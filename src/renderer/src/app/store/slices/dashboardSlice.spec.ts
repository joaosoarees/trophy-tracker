import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';
import { type DashboardMode, type IGameSummary } from '@shared/types/Game';
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
 * so: `asked` holds one per request, in the order they were made, and `modes`
 * what each one asked for.
 */
async function setup() {
  const asked: ReturnType<typeof deferred<CheckResult<IGameSummary[]>>>[] = [];
  const modes: (DashboardMode | undefined)[] = [];
  const api: Partial<IApi> = {
    getDashboard: (mode) => {
      const answer = deferred<CheckResult<IGameSummary[]>>();
      asked.push(answer);
      modes.push(mode);
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
  return { ...made, asked, modes };
}

describe('dashboardSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('load', () => {
    it('should say the dashboard is being read when the main process has not answered yet', async () => {
      const { sut, asked } = await setup();
      asked[0].resolve({ ok: true, value: [makeGameSummary({ appid: 10 })] });
      await turn();

      void sut.getState().dashboard.load('all');

      expect(sut.getState().dashboard).toMatchObject({
        games: [makeGameSummary({ appid: 10 })],
        isLoading: true,
        error: null,
        progress: null,
      });
    });

    it('should ask for what the main process already has when no mode is given', async () => {
      const { sut, asked, modes } = await setup();
      asked[0].resolve({ ok: true, value: [] });
      await turn();

      void sut.getState().dashboard.load();

      expect(modes).toEqual(['cached', 'cached']);
    });

    it('should ask the main process in the mode it was given', async () => {
      const { sut, asked, modes } = await setup();
      asked[0].resolve({ ok: true, value: [] });
      await turn();

      void sut.getState().dashboard.load('all');

      expect(modes).toEqual(['cached', 'all']);
    });

    it('should ask the main process once when the dashboard is asked for again before the answer', async () => {
      const { sut, modes } = await setup();

      void sut.getState().dashboard.load('all');

      expect(modes).toEqual(['cached']);
    });

    it('should forget the progress of the read before when another read starts', async () => {
      const { sut, asked } = await setup();
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });
      await turn();
      sut.getState().dashboard.setProgress(3, 10);

      void sut.getState().dashboard.load();

      expect(sut.getState().dashboard.progress).toBeNull();
    });

    it('should forget the progress when the dashboard has been read', async () => {
      const { sut, asked } = await setup();
      sut.getState().dashboard.setProgress(3, 10);
      asked[0].resolve({ ok: true, value: [] });

      await turn();

      expect(sut.getState().dashboard.progress).toBeNull();
    });

    it('should show the failure when the dashboard cannot be read', async () => {
      const { sut, asked } = await setup();
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });

      await turn();

      expect(sut.getState().dashboard).toMatchObject({
        games: null,
        isLoading: false,
        error: 'Steam did not answer.',
        progress: null,
      });
    });

    it('should keep the games it listed when reading them again fails', async () => {
      const { sut, asked } = await setup();
      asked[0].resolve({ ok: true, value: [makeGameSummary({ appid: 10 })] });
      await turn();
      const loading = sut.getState().dashboard.load('all');
      asked[1].resolve({ ok: false, error: 'Steam did not answer.' });

      await loading;

      expect(sut.getState().dashboard).toMatchObject({
        games: [makeGameSummary({ appid: 10 })],
        isLoading: false,
        error: 'Steam did not answer.',
      });
    });

    it('should drop the failure when the next read works', async () => {
      const { sut, asked } = await setup();
      asked[0].resolve({ ok: false, error: 'Steam did not answer.' });
      await turn();
      const loading = sut.getState().dashboard.load();
      asked[1].resolve({ ok: true, value: [makeGameSummary({ appid: 10 })] });

      await loading;

      expect(sut.getState().dashboard).toMatchObject({
        games: [makeGameSummary({ appid: 10 })],
        isLoading: false,
        error: null,
      });
    });

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

  describe('setProgress', () => {
    it('should show how many games were read when the main process reports it', async () => {
      const { sut } = await setup();

      sut.getState().dashboard.setProgress(3, 10);

      expect(sut.getState().dashboard.progress).toEqual([3, 10]);
    });
  });
});
