import { describe, expect, it } from 'vitest';

import {
  AppUpdates,
  type IAutoUpdater,
  type IAutoUpdaterListener,
} from '@main/services/AppUpdates';
import { type IAppInfo } from '@shared/types/AppInfo';

const HOUR = 60 * 60 * 1000;
const MANUAL: IAppInfo = {
  version: '1.0.0',
  newVersion: '1.1.0',
  updateStatus: 'manual',
  downloadPercent: null,
};
const downloading = (percent: number): IAppInfo => ({
  version: '1.0.0',
  newVersion: '1.1.0',
  updateStatus: 'downloading',
  downloadPercent: percent,
});
const READY: IAppInfo = {
  version: '1.0.0',
  newVersion: '1.1.0',
  updateStatus: 'ready',
  downloadPercent: null,
};
const NOTHING: IAppInfo = {
  version: '1.0.0',
  newVersion: null,
  updateStatus: 'downloading',
  downloadPercent: null,
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

interface ISetup {
  withAuto?: boolean;
  blocked?: boolean;
  /** What the automatic check finds. */
  latest?: string | null;
  /** Version a previous run closed itself to install. */
  attempted?: string | null;
}

function setup({
  withAuto = true,
  blocked = false,
  latest = '1.1.0',
  attempted = null,
}: ISetup = {}) {
  const calls = { check: 0, download: 0, install: 0, manual: 0, forced: 0 };
  const net = { online: true };
  const changes: IAppInfo[] = [];
  const logged: string[] = [];
  const clock = { now: 0 };
  const attempt = { version: attempted };
  let listener: IAutoUpdaterListener | null = null;

  const auto: IAutoUpdater = {
    start: (l) => (listener = l),
    check: () => {
      calls.check++;
      return net.online
        ? Promise.resolve(latest)
        : Promise.reject(new Error('offline'));
    },
    download: () => {
      calls.download++;
      return Promise.resolve();
    },
    install: () => void calls.install++,
  };
  const updates = new AppUpdates({
    currentVersion: '1.0.0',
    auto: withAuto ? auto : null,
    checker: {
      getAppInfo: () => {
        calls.manual++;
        return Promise.resolve(MANUAL);
      },
      check: () => {
        calls.forced++;
        return Promise.resolve(net.online);
      },
    },
    isInstallBlocked: () => Promise.resolve(blocked),
    attempt: {
      get: () => attempt.version,
      set: (version) => (attempt.version = version),
    },
    onChange: (info) => changes.push(info),
    logError: (_source, detail) => logged.push(detail),
    now: () => clock.now,
  });

  return {
    updates,
    calls,
    changes,
    logged,
    clock,
    net,
    attempt,
    emit: () => listener as unknown as IAutoUpdaterListener,
  };
}

describe('AppUpdates', () => {
  it('points to the download page where the app cannot update itself', async () => {
    const { updates, calls } = setup({ withAuto: false });
    expect(await updates.getAppInfo()).toEqual(MANUAL);
    expect(await updates.checkNow()).toEqual({ ok: true, info: MANUAL });
    updates.install();
    expect(calls).toMatchObject({ check: 0, download: 0, install: 0 });
  });

  it('finds a version when asked and starts downloading it', async () => {
    const { updates, calls, changes } = setup();
    expect(await updates.checkNow()).toEqual({
      ok: true,
      info: downloading(0),
    });
    expect(calls).toMatchObject({ check: 1, download: 1 });
    expect(changes).toEqual([downloading(0)]);
  });

  it('says there is nothing new without downloading anything', async () => {
    for (const latest of [null, '1.0.0', '0.9.0']) {
      const { updates, calls, changes } = setup({ latest });
      expect(await updates.checkNow()).toEqual({ ok: true, info: NOTHING });
      expect(calls.download).toBe(0);
      expect(changes).toEqual([]);
    }
  });

  it('announces the progress only when the whole number changes', async () => {
    const { updates, changes, emit } = setup();
    await updates.checkNow();
    for (const percent of [0.4, 12.2, 12.9, 13.1, 100]) {
      emit().onProgress(percent);
    }
    emit().onReady('1.1.0');

    expect(changes).toEqual([
      downloading(0),
      downloading(12),
      downloading(13),
      downloading(100),
      READY,
    ]);
    expect(await updates.getAppInfo()).toEqual(READY);
  });

  it('installs only a version that finished downloading, and remembers the attempt', async () => {
    const { updates, calls, attempt, emit } = setup();
    updates.install();
    await updates.checkNow();
    updates.install();
    expect(calls.install).toBe(0);
    expect(attempt.version).toBeNull();

    emit().onReady('1.1.0');
    updates.install();
    expect(calls.install).toBe(1);
    expect(attempt.version).toBe('1.1.0');
  });

  it('does not try again a version whose install already failed', async () => {
    // The app closed itself to install 1.1.0 and is still 1.0.0.
    const { updates, calls } = setup({ attempted: '1.1.0' });
    expect(await updates.checkNow()).toEqual({ ok: true, info: MANUAL });
    expect(calls.download).toBe(0);
    // Asking again does not change the answer.
    expect((await updates.checkNow()).info).toEqual(MANUAL);
    expect(calls.download).toBe(0);
  });

  it('tries a later version even after an install failed', async () => {
    const { updates, calls } = setup({ attempted: '1.1.0', latest: '1.2.0' });
    expect((await updates.checkNow()).info.updateStatus).toBe('downloading');
    expect(calls.download).toBe(1);
  });

  it('forgets an attempt that worked', () => {
    expect(setup({ attempted: '1.0.0' }).attempt.version).toBeNull();
    expect(setup({ attempted: '0.9.0' }).attempt.version).toBeNull();
    expect(setup({ attempted: '1.1.0' }).attempt.version).toBe('1.1.0');
  });

  it('looks in the background once every six hours, and not while a version is on its way', async () => {
    const { updates, calls, clock } = setup({ latest: null });
    await updates.getAppInfo();
    await settle();
    clock.now = 5 * HOUR;
    await updates.getAppInfo();
    expect(calls.check).toBe(1);

    clock.now = 7 * HOUR;
    await updates.getAppInfo();
    await settle();
    expect(calls.check).toBe(2);

    const found = setup();
    await found.updates.checkNow();
    found.clock.now = 20 * HOUR;
    await found.updates.getAppInfo();
    await found.updates.checkNow();
    expect(found.calls.check).toBe(1);
  });

  it('shares one look between simultaneous checks', async () => {
    const { updates, calls } = setup();
    await Promise.all([updates.checkNow(), updates.checkNow()]);
    expect(calls).toMatchObject({ check: 1, download: 1 });
  });

  it('falls back to the download page when the download fails', async () => {
    const { updates, changes, logged, emit } = setup();
    await updates.checkNow();
    emit().onError('checksum mismatch');
    await settle();

    expect(logged).toEqual(['checksum mismatch']);
    expect(changes.at(-1)).toEqual(MANUAL);
    expect(await updates.getAppInfo()).toEqual(MANUAL);
  });

  it('answers through GitHub when the automatic check cannot be made, and retries on request', async () => {
    const { updates, calls, net } = setup();
    net.online = false;
    expect((await updates.checkNow()).ok).toBe(false);
    expect(await updates.getAppInfo()).toEqual(MANUAL);

    net.online = true;
    expect(await updates.checkNow()).toEqual({
      ok: true,
      info: downloading(0),
    });
    expect(calls.check).toBe(2);
  });

  it('only tells about a version the system would refuse to install', async () => {
    const { updates, calls } = setup({ blocked: true });
    const blockedInfo = { ...MANUAL, updateStatus: 'blocked' };

    expect(await updates.getAppInfo()).toEqual(blockedInfo);
    expect(await updates.checkNow()).toEqual({ ok: true, info: blockedInfo });
    updates.install();
    expect(calls).toMatchObject({ check: 0, download: 0, install: 0 });
  });

  it('ignores progress reported after the download finished', async () => {
    const { updates, changes, emit } = setup();
    await updates.checkNow();
    emit().onReady('1.1.0');
    emit().onProgress(50);
    expect(changes.at(-1)).toEqual(READY);
  });
});
