import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppState } from '@shared/types/AppState';
import { type CurrentGame, type DashboardMode } from '@shared/types/Game';
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
 * `asked` holds one answer per request, in the order they were made. The
 * dashboard is answered at once, and `dashboardModes` holds what each of its
 * reads asked for.
 */
async function setup() {
  const asked: ReturnType<typeof deferred<CurrentGame>>[] = [];
  const dashboardModes: (DashboardMode | undefined)[] = [];
  const api: Partial<IApi> = {
    getCurrentAppId: () => {
      const answer = deferred<CurrentGame>();
      asked.push(answer);
      return answer.promise;
    },
    getDashboard: (mode) => {
      dashboardModes.push(mode);
      return Promise.resolve({ ok: true, value: [] });
    },
    onStateChanged: () => () => {},
    onGameChanged: () => () => {},
    onGameUpdated: () => () => {},
    onDashboardProgress: () => () => {},
  };
  const made = await makeAppStore({ api });
  made.follow(makeAppState());
  // The dashboard asked for as the store is wired has been listed.
  await turn();
  return { ...made, asked, dashboardModes };
}

describe('sessionSlice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('setLanguage', () => {
    it('should put the interface in the language when it is picked', async () => {
      const { sut } = await setup();

      sut.getState().session.setLanguage('fr');

      expect(sut.getState().session.language).toBe('fr');
    });
  });

  describe('setCurrent', () => {
    it('should show the game when the main process says it is the current one', async () => {
      const { sut } = await setup();

      sut.getState().session.setCurrent({ appid: 7, isRunning: true });

      expect(sut.getState().session.current).toEqual({
        appid: 7,
        isRunning: true,
      });
    });

    it.each<[string, CurrentGame]>([
      ['it is now the last one played', { appid: 7, isRunning: false }],
      ['there is no current game any more', null],
    ])(
      'should read again the games that changed when the running game closes and %s',
      async (_case, afterClosing) => {
        const { sut, dashboardModes } = await setup();
        sut.getState().session.setCurrent({ appid: 7, isRunning: true });

        sut.getState().session.setCurrent(afterClosing);

        expect(dashboardModes).toEqual(['cached', 'changed']);
      },
    );

    it('should not read the dashboard again when a game starts', async () => {
      const { sut, dashboardModes } = await setup();
      sut.getState().session.setCurrent({ appid: 7, isRunning: false });

      sut.getState().session.setCurrent({ appid: 7, isRunning: true });

      expect(dashboardModes).toEqual(['cached']);
    });

    it('should not read the dashboard again when the last played game changes with none running', async () => {
      const { sut, dashboardModes } = await setup();
      sut.getState().session.setCurrent({ appid: 7, isRunning: false });

      sut.getState().session.setCurrent({ appid: 8, isRunning: false });

      expect(dashboardModes).toEqual(['cached']);
    });

    it('should not read the dashboard again when the running game is said to be running again', async () => {
      const { sut, dashboardModes } = await setup();
      sut.getState().session.setCurrent({ appid: 7, isRunning: true });

      sut.getState().session.setCurrent({ appid: 7, isRunning: true });

      expect(dashboardModes).toEqual(['cached']);
    });
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
