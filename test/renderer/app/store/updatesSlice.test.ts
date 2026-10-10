import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type IApi } from '@shared/types/Api';
import { type IAppInfo, type IUpdateCheck } from '@shared/types/AppInfo';
import { makeAppInfo } from '@test/factories/makeAppInfo';
import { makeAppState } from '@test/factories/makeAppState';

import { deferred, makeStore } from './makeStore';

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

const found = (info: IAppInfo): IUpdateCheck => ({ ok: true, info });

/** The app opening: a store, a main process whose check the test answers, and `start()` called. */
async function open(options: { session?: Record<string, string> } = {}) {
  const check = deferred<IUpdateCheck>();
  let announce: (info: IAppInfo) => void = () => {};
  const api = {
    checkForUpdates: vi.fn(() => check.promise),
    getAppInfo: vi.fn(() => Promise.resolve(NOTHING)),
    installUpdate: vi.fn(() => Promise.resolve()),
    onAppInfoChanged: vi.fn((cb: (info: IAppInfo) => void) => {
      announce = cb;
      return () => {};
    }),
  } satisfies Partial<IApi>;

  const made = await makeStore({ api, session: options.session });
  made.store.getState().updates.start();

  return {
    ...made,
    api,
    updates: () => made.store.getState().updates,
    /** The main process answers the check made as the app opens. */
    answer: async (result: IUpdateCheck) => {
      check.resolve(result);
      await vi.advanceTimersByTimeAsync(0);
    },
    /** The main process announces a change by itself. */
    announce: (info: IAppInfo) => announce(info),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('updates: as the app opens', () => {
  it('holds the first screen while it waits to hear about a new version', async () => {
    const { updates } = await open();

    expect(updates().startup).toBe('checking');
  });

  it('opens the app when there is nothing new', async () => {
    const { updates, answer, toast } = await open();

    await answer(found(NOTHING));

    expect(updates().startup).toBe('done');
    expect(toast).not.toHaveBeenCalled();
  });

  it('stays on the update screen when a version it can install is found in time', async () => {
    const { updates, answer } = await open();

    await answer(found(DOWNLOADING));

    expect(updates().startup).toBe('updating');
    expect(updates().appInfo).toEqual(DOWNLOADING);
  });

  it('follows the download progress on the update screen', async () => {
    const { updates, answer, announce } = await open();
    await answer(found(DOWNLOADING));

    announce({ ...DOWNLOADING, downloadPercent: 42 });

    expect(updates().appInfo?.downloadPercent).toBe(42);
    expect(updates().startup).toBe('updating');
  });

  it('restarts by itself when the download started at opening finishes', async () => {
    const { answer, announce, api } = await open();
    await answer(found(DOWNLOADING));

    announce(READY);

    expect(api.installUpdate).toHaveBeenCalledTimes(1);
  });

  it('restarts at once when a version was already downloaded', async () => {
    const { answer, api } = await open();

    await answer(found(READY));

    expect(api.installUpdate).toHaveBeenCalledTimes(1);
  });

  it('opens the app and says so when the download fails', async () => {
    const { updates, answer, announce, toast } = await open();
    await answer(found(DOWNLOADING));

    announce(MANUAL);

    expect(updates().startup).toBe('done');
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it.each([
    { where: 'the user has to download it', info: MANUAL },
    { where: 'the system would block the install', info: BLOCKED },
  ])(
    'opens the app and announces the version when $where',
    async ({ info }) => {
      const { updates, answer, toast, api } = await open();

      await answer(found(info));

      expect(updates().startup).toBe('done');
      expect(toast).toHaveBeenCalledWith(
        'Version 1.1.0 is available',
        expect.anything(),
      );
      expect(api.installUpdate).not.toHaveBeenCalled();
    },
  );

  it('opens the app when the check cannot be made', async () => {
    const { updates, answer, toast } = await open();

    await answer({ ok: false, info: NOTHING });

    expect(updates().startup).toBe('done');
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('updates: the announcement toast', () => {
  it('leads to Settings once the app is set up', async () => {
    const { store, answer, toast } = await open();
    store.getState().settings.apply(makeAppState());

    await answer(found(MANUAL));
    const action = toast.mock.calls[0][1]?.action as
      { onClick: () => void } | undefined;
    action?.onClick();

    expect(store.getState().navigation.tab).toBe('settings');
  });

  it('has no shortcut during the onboarding, where there is no Settings', async () => {
    const { answer, toast } = await open();

    await answer(found(MANUAL));

    expect(toast.mock.calls[0][1]?.action).toBeUndefined();
  });
});

describe('updates: when the answer takes too long', () => {
  it('opens the app after four seconds without an answer', async () => {
    const { updates } = await open();

    await vi.advanceTimersByTimeAsync(4000);

    expect(updates().startup).toBe('done');
  });

  it('does not go back to the update screen when the version arrives late', async () => {
    const { updates, answer } = await open();
    await vi.advanceTimersByTimeAsync(4000);

    await answer(found(DOWNLOADING));

    expect(updates().startup).toBe('done');
    expect(updates().appInfo).toEqual(DOWNLOADING);
  });

  it('still announces a late version the user has to fetch', async () => {
    const { answer, toast } = await open();
    await vi.advanceTimersByTimeAsync(4000);

    await answer(found(MANUAL));

    expect(toast).toHaveBeenCalledTimes(1);
  });
});

describe('updates: with the app in use', () => {
  /** The app open, past the startup check, with nothing new found. */
  async function inUse() {
    const app = await open();
    await app.answer(found(NOTHING));
    return app;
  }

  it('asks before restarting when a version finishes downloading', async () => {
    const { updates, announce, api } = await inUse();
    announce(DOWNLOADING);

    announce(READY);

    expect(updates().isReadyDialogOpen).toBe(true);
    expect(api.installUpdate).not.toHaveBeenCalled();
  });

  it('does not ask again for the same downloaded version', async () => {
    const { updates, announce } = await inUse();
    announce(READY);
    updates().dismissReady();

    announce(READY);

    expect(updates().isReadyDialogOpen).toBe(false);
  });

  it('restarts when the user accepts, after writing what was waiting to be saved', async () => {
    const { store, updates, announce, api } = await inUse();
    const order: string[] = [];
    store.setState((state) => {
      state.userData.flush = () => void order.push('flush');
    });
    api.installUpdate.mockImplementation(() => {
      order.push('install');
      return Promise.resolve();
    });
    announce(READY);

    updates().restart();

    expect(order).toEqual(['flush', 'install']);
  });

  it('answers whether a requested check could be made, keeping what it found', async () => {
    const { updates, api } = await inUse();
    api.checkForUpdates.mockResolvedValueOnce(found(MANUAL));

    const ok = await updates().check();

    expect(ok).toBe(true);
    expect(updates().appInfo).toEqual(MANUAL);
    expect(updates().isChecking).toBe(false);
  });

  it('says a check is running while it waits for the answer', async () => {
    const { updates, api } = await inUse();
    api.checkForUpdates.mockReturnValueOnce(new Promise(() => {}));

    void updates().check();

    expect(updates().isChecking).toBe(true);
  });

  it('brings the restart question back after it was put off', async () => {
    const { updates, announce } = await inUse();
    announce(READY);
    updates().dismissReady();

    updates().showReady();

    expect(updates().isReadyDialogOpen).toBe(true);
  });

  it('has no restart question to show while nothing is downloaded', async () => {
    const { updates } = await inUse();

    updates().showReady();

    expect(updates().isReadyDialogOpen).toBe(false);
  });

  it('reports a requested check that failed', async () => {
    const { updates, api } = await inUse();
    api.checkForUpdates.mockRejectedValueOnce(new Error('offline'));

    expect(await updates().check()).toBe(false);
    expect(updates().isChecking).toBe(false);
  });
});

describe('updates: after a window reload', () => {
  const afterReload = { 'updates.checkedOnStartup': 'true' };

  it('does not hold the app or check again', async () => {
    const { updates, api } = await open({ session: afterReload });

    expect(updates().startup).toBe('done');
    expect(api.checkForUpdates).not.toHaveBeenCalled();
  });

  it('reads what the main process already knows', async () => {
    const { updates, api } = await open({ session: afterReload });
    api.getAppInfo.mockResolvedValue(MANUAL);

    updates().start();
    await vi.advanceTimersByTimeAsync(0);

    expect(updates().appInfo).toEqual(MANUAL);
  });

  it('remembers that the startup check ran, for the next reload', async () => {
    const { answer, storage } = await open();

    await answer(found(NOTHING));

    expect(storage.get('updates.checkedOnStartup')).toBe('true');
  });
});
