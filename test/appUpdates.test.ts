import { describe, expect, it } from 'vitest';

import {
  AppUpdates,
  type IAutoUpdater,
  type IAutoUpdaterListener,
} from '../src/main/services/AppUpdates';
import { type IAppInfo } from '../src/shared/types/AppInfo';

const HOUR = 60 * 60 * 1000;
const MANUAL: IAppInfo = {
  version: '1.0.0',
  newVersion: '1.1.0',
  updateStatus: 'manual',
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup({ withAuto = true, checkFails = false, blocked = false } = {}) {
  const calls = { check: 0, install: 0, manual: 0, forced: 0 };
  const net = { online: true };
  const changes: IAppInfo[] = [];
  const logged: string[] = [];
  const clock = { now: 0 };
  let listener: IAutoUpdaterListener | null = null;

  const auto: IAutoUpdater = {
    start: (l) => (listener = l),
    check: () => {
      calls.check++;
      return checkFails || !net.online
        ? Promise.reject(new Error('offline'))
        : Promise.resolve();
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
    emit: () => listener as unknown as IAutoUpdaterListener,
  };
}

describe('AppUpdates', () => {
  it('points to the download page where the app cannot update itself', async () => {
    const { updates, calls } = setup({ withAuto: false });
    expect(await updates.getAppInfo()).toEqual(MANUAL);
    updates.install();
    expect(calls).toEqual({ check: 0, install: 0, manual: 1, forced: 0 });
  });

  it('downloads in the background and announces each stage', async () => {
    const { updates, calls, changes, emit } = setup();
    expect(await updates.getAppInfo()).toEqual({
      version: '1.0.0',
      newVersion: null,
      updateStatus: 'downloading',
    });
    expect(calls.check).toBe(1);

    emit().onDownloading('1.1.0');
    emit().onReady('1.1.0');
    expect(changes.map((c) => [c.newVersion, c.updateStatus])).toEqual([
      ['1.1.0', 'downloading'],
      ['1.1.0', 'ready'],
    ]);
    expect((await updates.getAppInfo()).updateStatus).toBe('ready');
  });

  it('installs only a version that finished downloading', () => {
    const { updates, calls, emit } = setup();
    updates.install();
    emit().onDownloading('1.1.0');
    updates.install();
    expect(calls.install).toBe(0);

    emit().onReady('1.1.0');
    updates.install();
    expect(calls.install).toBe(1);
  });

  it('looks for a version once every six hours, and not again once one is ready', async () => {
    const { updates, calls, clock, emit } = setup();
    await updates.getAppInfo();
    clock.now = 5 * HOUR;
    await updates.getAppInfo();
    expect(calls.check).toBe(1);

    clock.now = 7 * HOUR;
    await updates.getAppInfo();
    expect(calls.check).toBe(2);

    emit().onReady('1.1.0');
    clock.now = 20 * HOUR;
    await updates.getAppInfo();
    expect(calls.check).toBe(2);
  });

  it('falls back to the download page when the automatic update fails', async () => {
    const { updates, changes, logged, emit } = setup();
    await updates.getAppInfo();
    emit().onDownloading('1.1.0');
    emit().onError('checksum mismatch');
    await settle();

    expect(logged).toEqual(['checksum mismatch']);
    expect(changes.at(-1)).toEqual(MANUAL);
    expect(await updates.getAppInfo()).toEqual(MANUAL);
  });

  it('falls back as well when the check itself cannot be made', async () => {
    const { updates, changes } = setup({ checkFails: true });
    await updates.getAppInfo();
    await settle();
    expect(changes).toEqual([MANUAL]);
  });

  it('checks on request without waiting for the six hours', async () => {
    const { updates, calls } = setup();
    await updates.getAppInfo();
    expect(await updates.checkNow()).toEqual({
      ok: true,
      info: { version: '1.0.0', newVersion: null, updateStatus: 'downloading' },
    });
    expect(calls.check).toBe(2);
  });

  it('answers a requested check through GitHub where the app cannot update itself', async () => {
    const { updates, calls, net } = setup({ withAuto: false });
    expect(await updates.checkNow()).toEqual({ ok: true, info: MANUAL });
    net.online = false;
    expect((await updates.checkNow()).ok).toBe(false);
    expect(calls.forced).toBe(2);
  });

  it('gives the automatic update another chance on a requested check', async () => {
    const { updates, calls, net, emit } = setup();
    net.online = false;
    expect((await updates.checkNow()).ok).toBe(false);
    expect((await updates.getAppInfo()).updateStatus).toBe('manual');

    net.online = true;
    const check = updates.checkNow();
    emit().onDownloading('1.1.0');
    expect(await check).toEqual({
      ok: true,
      info: {
        version: '1.0.0',
        newVersion: '1.1.0',
        updateStatus: 'downloading',
      },
    });
    expect(calls.check).toBe(2);
  });

  it('does not look again for a version that is ready to install', async () => {
    const { updates, calls, emit } = setup();
    emit().onReady('1.1.0');
    expect((await updates.checkNow()).info.updateStatus).toBe('ready');
    expect(calls.check).toBe(0);
  });

  it('only tells about a version the system would refuse to install', async () => {
    const { updates, calls } = setup({ blocked: true });
    const blockedInfo = { ...MANUAL, updateStatus: 'blocked' };

    expect(await updates.getAppInfo()).toEqual(blockedInfo);
    expect(await updates.checkNow()).toEqual({ ok: true, info: blockedInfo });
    updates.install();
    // Nothing was downloaded and nothing tries to install.
    expect(calls.check).toBe(0);
    expect(calls.install).toBe(0);
  });

  it('keeps a finished download when a late progress event arrives', () => {
    const { changes, emit } = setup();
    emit().onReady('1.1.0');
    emit().onDownloading('1.1.0');
    expect(changes).toHaveLength(1);
  });
});
