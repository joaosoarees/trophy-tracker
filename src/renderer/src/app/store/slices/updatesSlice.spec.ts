import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type IAppInfo, type IUpdateCheck } from '@shared/types/AppInfo';
import { makeAppInfo } from '@tests/factories/makeAppInfo';
import { makeAppState } from '@tests/factories/makeAppState';
import { deferred, makeAppStore } from '@tests/makeAppStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

const DOWNLOADING = makeAppInfo({
  newVersion: '1.1.0',
  updateStatus: 'downloading',
  downloadPercent: 0,
});
const READY = makeAppInfo({ newVersion: '1.1.0', updateStatus: 'ready' });
const MANUAL = makeAppInfo({ newVersion: '1.1.0', updateStatus: 'manual' });
const BLOCKED = makeAppInfo({ newVersion: '1.1.0', updateStatus: 'blocked' });
const NOTHING = makeAppInfo();

/** Versions the app cannot install by itself. */
const NEEDING_THE_USER = [
  { where: 'the user has to download it', info: MANUAL },
  { where: 'the system would block the install', info: BLOCKED },
];

/** What the toast says about version 1.1.0. */
const AVAILABLE = 'Version 1.1.0 is available';

/** `sessionStorage` after a reload of a window whose startup check ran. */
const AFTER_RELOAD = { 'updates.checkedOnStartup': 'true' };

/** How long the app holds its first screen waiting for the check. */
const STARTUP_WAIT = 4000;

const found = (info: IAppInfo): IUpdateCheck => ({ ok: true, info });

interface ISetupOptions {
  /** What is already in `sessionStorage`. */
  session?: Record<string, string>;
  /** What the main process already knows about updates. */
  known?: IAppInfo;
}

/**
 * The store before `start()`, and a main process whose first check the test
 * answers.
 */
async function setup({ session, known = NOTHING }: ISetupOptions = {}) {
  const check = deferred<IUpdateCheck>();
  let onAppInfoChanged: (info: IAppInfo) => void = () => {};
  const checkForUpdatesMock = vi.fn(() => check.promise);
  const installUpdateMock = vi.fn(() => Promise.resolve());

  const made = await makeAppStore({
    api: {
      checkForUpdates: checkForUpdatesMock,
      getAppInfo: () => Promise.resolve(known),
      installUpdate: installUpdateMock,
      onAppInfoChanged: (cb) => {
        onAppInfoChanged = cb;
        return () => {};
      },
    },
    session,
  });

  let toastButton: { onClick: () => void } | undefined;
  made.toastMock.mockImplementation((_message, options) => {
    toastButton = options?.action as { onClick: () => void } | undefined;
    return 0;
  });

  return {
    ...made,
    checkForUpdatesMock,
    installUpdateMock,
    /** The main process answers the check made as the app opens. */
    answer: async (result: IUpdateCheck) => {
      check.resolve(result);
      await vi.advanceTimersByTimeAsync(0);
    },
    /** The main process announces a change by itself. */
    announce: (info: IAppInfo) => onAppInfoChanged(info),
    /** The user clicks the button of the last toast shown. */
    clickToastButton: () => {
      if (!toastButton) throw new Error('The last toast had no button');
      toastButton.onClick();
    },
  };
}

/** The app opening: `start()` called, the check not answered yet. */
async function open(options: ISetupOptions = {}) {
  const app = await setup(options);
  app.sut.getState().updates.start();
  return app;
}

/** The app open, past the startup check, with nothing new found. */
async function inUse() {
  const app = await open();
  await app.answer(found(NOTHING));
  return app;
}

describe('updatesSlice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('as the app opens', () => {
    it('should hold the first screen when the check is not answered yet', async () => {
      const { sut } = await setup();

      sut.getState().updates.start();

      expect(sut.getState().updates.startup).toBe('checking');
    });

    it('should open the app when there is nothing new', async () => {
      const { sut, answer } = await open();

      await answer(found(NOTHING));

      expect(sut.getState().updates.startup).toBe('done');
    });

    it('should announce nothing when there is nothing new', async () => {
      const { answer, toastMock } = await open();

      await answer(found(NOTHING));

      expect(toastMock).not.toHaveBeenCalled();
    });

    it('should stay on the update screen when a version it can install is found in time', async () => {
      const { sut, answer } = await open();

      await answer(found(DOWNLOADING));

      expect(sut.getState().updates.startup).toBe('updating');
    });

    it('should keep what was found when a version it can install is found in time', async () => {
      const { sut, answer } = await open();

      await answer(found(DOWNLOADING));

      expect(sut.getState().updates.appInfo).toEqual(DOWNLOADING);
    });

    it('should follow the download when the main process announces its progress', async () => {
      const { sut, answer, announce } = await open();
      await answer(found(DOWNLOADING));

      announce({ ...DOWNLOADING, downloadPercent: 42 });

      expect(sut.getState().updates.appInfo).toEqual({
        ...DOWNLOADING,
        downloadPercent: 42,
      });
    });

    it('should stay on the update screen when the download progresses', async () => {
      const { sut, answer, announce } = await open();
      await answer(found(DOWNLOADING));

      announce({ ...DOWNLOADING, downloadPercent: 42 });

      expect(sut.getState().updates.startup).toBe('updating');
    });

    it('should restart by itself when the download started at opening finishes', async () => {
      const { answer, announce, installUpdateMock } = await open();
      await answer(found(DOWNLOADING));

      announce(READY);

      expect(installUpdateMock).toHaveBeenCalledExactlyOnceWith();
    });

    it('should restart at once when a version was already downloaded', async () => {
      const { answer, installUpdateMock } = await open();

      await answer(found(READY));

      expect(installUpdateMock).toHaveBeenCalledExactlyOnceWith();
    });

    it('should open the app when the download fails', async () => {
      const { sut, answer, announce } = await open();
      await answer(found(DOWNLOADING));

      announce(MANUAL);

      expect(sut.getState().updates.startup).toBe('done');
    });

    it('should announce the version when the download fails', async () => {
      const { answer, announce, toastMock } = await open();
      await answer(found(DOWNLOADING));

      announce(MANUAL);

      expect(toastMock).toHaveBeenCalledExactlyOnceWith(
        AVAILABLE,
        expect.any(Object),
      );
    });

    it.each(NEEDING_THE_USER)(
      'should open the app when $where',
      async ({ info }) => {
        const { sut, answer } = await open();

        await answer(found(info));

        expect(sut.getState().updates.startup).toBe('done');
      },
    );

    it.each(NEEDING_THE_USER)(
      'should announce the version when $where',
      async ({ info }) => {
        const { answer, toastMock } = await open();

        await answer(found(info));

        expect(toastMock).toHaveBeenCalledExactlyOnceWith(
          AVAILABLE,
          expect.any(Object),
        );
      },
    );

    it.each(NEEDING_THE_USER)(
      'should not restart when $where',
      async ({ info }) => {
        const { answer, installUpdateMock } = await open();

        await answer(found(info));

        expect(installUpdateMock).not.toHaveBeenCalled();
      },
    );

    it('should open the app when the check cannot be made', async () => {
      const { sut, answer } = await open();

      await answer({ ok: false, info: NOTHING });

      expect(sut.getState().updates.startup).toBe('done');
    });

    it('should announce nothing when the check cannot be made', async () => {
      const { answer, toastMock } = await open();

      await answer({ ok: false, info: NOTHING });

      expect(toastMock).not.toHaveBeenCalled();
    });
  });

  describe('the announcement toast', () => {
    it('should lead to Settings when its button is clicked in an app that is set up', async () => {
      const { sut, answer, clickToastButton } = await open();
      sut.getState().settings.apply(makeAppState());
      await answer(found(MANUAL));

      clickToastButton();

      expect(sut.getState().navigation.tab).toBe('settings');
    });

    it('should have no button when the app is not set up yet', async () => {
      const { answer, toastMock } = await open();

      await answer(found(MANUAL));

      expect(toastMock).toHaveBeenCalledExactlyOnceWith(AVAILABLE, {
        duration: 10_000,
      });
    });
  });

  describe('when the answer takes too long', () => {
    it('should open the app when four seconds pass without an answer', async () => {
      const { sut } = await open();

      await vi.advanceTimersByTimeAsync(STARTUP_WAIT);

      expect(sut.getState().updates.startup).toBe('done');
    });

    it('should not go back to the update screen when the version arrives late', async () => {
      const { sut, answer } = await open();
      await vi.advanceTimersByTimeAsync(STARTUP_WAIT);

      await answer(found(DOWNLOADING));

      expect(sut.getState().updates.startup).toBe('done');
    });

    it('should keep what was found when the version arrives late', async () => {
      const { sut, answer } = await open();
      await vi.advanceTimersByTimeAsync(STARTUP_WAIT);

      await answer(found(DOWNLOADING));

      expect(sut.getState().updates.appInfo).toEqual(DOWNLOADING);
    });

    it('should announce the version when one the user has to fetch arrives late', async () => {
      const { answer, toastMock } = await open();
      await vi.advanceTimersByTimeAsync(STARTUP_WAIT);

      await answer(found(MANUAL));

      expect(toastMock).toHaveBeenCalledExactlyOnceWith(
        AVAILABLE,
        expect.any(Object),
      );
    });
  });

  describe('with the app in use', () => {
    it('should ask before restarting when a version finishes downloading', async () => {
      const { sut, announce } = await inUse();
      announce(DOWNLOADING);

      announce(READY);

      expect(sut.getState().updates.isReadyDialogOpen).toBe(true);
    });

    it('should not restart by itself when a version finishes downloading', async () => {
      const { announce, installUpdateMock } = await inUse();
      announce(DOWNLOADING);

      announce(READY);

      expect(installUpdateMock).not.toHaveBeenCalled();
    });

    it('should not ask again when the same downloaded version is announced', async () => {
      const { sut, announce } = await inUse();
      announce(READY);
      sut.getState().updates.dismissReady();

      announce(READY);

      expect(sut.getState().updates.isReadyDialogOpen).toBe(false);
    });

    it('should write what was waiting to be saved before it restarts when the user accepts', async () => {
      const { sut, announce, installUpdateMock } = await inUse();
      const order: string[] = [];
      sut.setState((state) => {
        state.userData.flush = () => void order.push('flush');
      });
      installUpdateMock.mockImplementationOnce(() => {
        order.push('install');
        return Promise.resolve();
      });
      announce(READY);

      sut.getState().updates.restart();

      expect(order).toEqual(['flush', 'install']);
    });

    it('should answer true when a requested check could be made', async () => {
      const { sut, checkForUpdatesMock } = await inUse();
      checkForUpdatesMock.mockResolvedValueOnce(found(MANUAL));

      const ok = await sut.getState().updates.check();

      expect(ok).toBe(true);
    });

    it('should answer false when a requested check could not be made', async () => {
      const { sut, checkForUpdatesMock } = await inUse();
      checkForUpdatesMock.mockResolvedValueOnce({ ok: false, info: NOTHING });

      const ok = await sut.getState().updates.check();

      expect(ok).toBe(false);
    });

    it('should keep what was found when a requested check is answered', async () => {
      const { sut, checkForUpdatesMock } = await inUse();
      checkForUpdatesMock.mockResolvedValueOnce(found(MANUAL));

      await sut.getState().updates.check();

      expect(sut.getState().updates.appInfo).toEqual(MANUAL);
    });

    it('should no longer say a check is running when a requested check is answered', async () => {
      const { sut, checkForUpdatesMock } = await inUse();
      checkForUpdatesMock.mockResolvedValueOnce(found(MANUAL));

      await sut.getState().updates.check();

      expect(sut.getState().updates.isChecking).toBe(false);
    });

    it('should say a check is running when a requested check is not answered yet', async () => {
      const { sut, checkForUpdatesMock } = await inUse();
      checkForUpdatesMock.mockReturnValueOnce(new Promise(() => {}));

      void sut.getState().updates.check();

      expect(sut.getState().updates.isChecking).toBe(true);
    });

    it('should answer false when a requested check fails', async () => {
      const { sut, checkForUpdatesMock } = await inUse();
      checkForUpdatesMock.mockRejectedValueOnce(new Error('offline'));

      const ok = await sut.getState().updates.check();

      expect(ok).toBe(false);
    });

    it('should no longer say a check is running when a requested check fails', async () => {
      const { sut, checkForUpdatesMock } = await inUse();
      checkForUpdatesMock.mockRejectedValueOnce(new Error('offline'));

      await sut.getState().updates.check();

      expect(sut.getState().updates.isChecking).toBe(false);
    });

    it('should bring the restart question back when it was put off', async () => {
      const { sut, announce } = await inUse();
      announce(READY);
      sut.getState().updates.dismissReady();

      sut.getState().updates.showReady();

      expect(sut.getState().updates.isReadyDialogOpen).toBe(true);
    });

    it('should show no restart question when nothing is downloaded', async () => {
      const { sut } = await inUse();

      sut.getState().updates.showReady();

      expect(sut.getState().updates.isReadyDialogOpen).toBe(false);
    });
  });

  describe('after a window reload', () => {
    it('should not hold the app when the startup check ran before the reload', async () => {
      const { sut } = await setup({ session: AFTER_RELOAD });

      const { startup } = sut.getState().updates;

      expect(startup).toBe('done');
    });

    it('should not check again when the startup check ran before the reload', async () => {
      const { sut, checkForUpdatesMock } = await setup({
        session: AFTER_RELOAD,
      });

      sut.getState().updates.start();

      expect(checkForUpdatesMock).not.toHaveBeenCalled();
    });

    it('should read what the main process already knows when the startup check ran before the reload', async () => {
      const { sut } = await setup({ session: AFTER_RELOAD, known: MANUAL });

      sut.getState().updates.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(sut.getState().updates.appInfo).toEqual(MANUAL);
    });

    it('should remember that the startup check ran when the app opens', async () => {
      const { answer, storage } = await open();

      await answer(found(NOTHING));

      expect(storage.get('updates.checkedOnStartup')).toBe('true');
    });
  });
});
