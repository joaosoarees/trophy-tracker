import { describe, expect, it } from 'vitest';

import { type IAppInfo } from '@shared/types/AppInfo';
import { makeAppInfo } from '@tests/factories/makeAppInfo';

import {
  AppUpdates,
  type IAutoUpdater,
  type IAutoUpdaterListener,
} from './AppUpdates';

const HOUR = 60 * 60 * 1000;
/** What GitHub answers where the app does not update itself. */
const MANUAL = makeAppInfo({ newVersion: '1.1.0' });
const downloading = (percent: number, newVersion = '1.1.0') =>
  makeAppInfo({
    newVersion,
    updateStatus: 'downloading',
    downloadPercent: percent,
  });
const READY = makeAppInfo({ newVersion: '1.1.0', updateStatus: 'ready' });
/** The automatic path with nothing found. */
const NOTHING = makeAppInfo({ updateStatus: 'idle' });
/** A version the system would refuse to install. */
const BLOCKED = makeAppInfo({ newVersion: '1.1.0', updateStatus: 'blocked' });

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

interface ISetup {
  hasAuto?: boolean;
  /** Whether the system would refuse the installer; `unknown` when it cannot be asked. */
  isBlocked?: boolean | 'unknown';
  /** What the automatic check finds. */
  latest?: string | null;
  /** Version a previous run closed itself to install. */
  attempted?: string | null;
}

function setup({
  hasAuto = true,
  isBlocked = false,
  latest = '1.1.0',
  attempted = null,
}: ISetup = {}) {
  const calls = {
    check: 0,
    download: 0,
    install: 0,
    manual: 0,
    forced: 0,
    blocked: 0,
  };
  /**
   * What the updater finds; a test changes it to publish or withdraw a
   * release, or to make the download of what was found fail.
   */
  const net = { online: true, latest, canDownload: true };
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
        ? Promise.resolve(net.latest)
        : Promise.reject(new Error('offline'));
    },
    download: () => {
      calls.download++;
      return net.canDownload
        ? Promise.resolve()
        : Promise.reject(new Error('connection lost'));
    },
    install: () => void calls.install++,
  };
  const sut = new AppUpdates({
    currentVersion: '1.0.0',
    auto: hasAuto ? auto : null,
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
    isInstallBlocked: () => {
      calls.blocked++;
      return isBlocked === 'unknown'
        ? Promise.reject(new Error('the system did not say'))
        : Promise.resolve(isBlocked);
    },
    attempt: {
      get: () => attempt.version,
      set: (version) => (attempt.version = version),
    },
    onChange: (info) => changes.push(info),
    logError: (_source, detail) => logged.push(detail),
    now: () => clock.now,
  });

  return {
    sut,
    calls,
    changes,
    logged,
    clock,
    net,
    attempt,
    /** The events of the updater, as the unit subscribed to them. */
    emit: (): IAutoUpdaterListener => {
      if (listener === null) throw new Error('auto.start was not called');
      return listener;
    },
  };
}

describe('AppUpdates', () => {
  describe('on start', () => {
    it.each([
      { attempted: '1.0.0', outcome: 'the running version' },
      { attempted: '0.9.0', outcome: 'a version since left behind' },
    ])(
      'should forget the install attempt when it was for $outcome',
      ({ attempted }) => {
        const { attempt } = setup({ attempted });

        expect(attempt.version).toBeNull();
      },
    );

    it('should keep the install attempt when its version is still not the running one', () => {
      const { attempt } = setup({ attempted: '1.1.0' });

      expect(attempt.version).toBe('1.1.0');
    });
  });

  describe('getAppInfo', () => {
    it('should answer what GitHub says when the app cannot update itself', async () => {
      const { sut } = setup({ hasAuto: false });

      const info = await sut.getAppInfo();

      expect(info).toEqual(MANUAL);
    });

    it('should answer the new version as blocked when the system would refuse to install it', async () => {
      const { sut } = setup({ isBlocked: true });

      const info = await sut.getAppInfo();

      expect(info).toEqual(BLOCKED);
    });

    it('should not look for a version when the system would refuse to install it', async () => {
      const { sut, calls } = setup({ isBlocked: true });

      await sut.getAppInfo();
      await settle();

      expect(calls).toMatchObject({ check: 0, download: 0 });
    });

    it('should answer that nothing is being fetched when no version was found', async () => {
      const { sut } = setup({ latest: null });
      await sut.checkNow();

      const info = await sut.getAppInfo();

      expect(info).toEqual(NOTHING);
    });

    it('should answer the version as ready when its download has finished', async () => {
      const { sut, emit } = setup();
      await sut.checkNow();
      emit().onReady('1.1.0');

      const info = await sut.getAppInfo();

      expect(info).toEqual(READY);
    });

    it('should answer what GitHub says when the updater reported an error', async () => {
      const { sut, emit } = setup();
      await sut.checkNow();
      emit().onError('checksum mismatch');
      await settle();

      const info = await sut.getAppInfo();

      expect(info).toEqual(MANUAL);
    });

    it('should answer what GitHub says when the automatic check could not be made', async () => {
      const { sut, net } = setup();
      net.online = false;
      await sut.checkNow();

      const info = await sut.getAppInfo();

      expect(info).toEqual(MANUAL);
    });

    it('should not look again in the background when six hours have not passed', async () => {
      const { sut, calls, clock } = setup({ latest: null });
      await sut.getAppInfo();
      await settle();
      clock.now = 5 * HOUR;

      await sut.getAppInfo();

      expect(calls.check).toBe(1);
    });

    it('should look again in the background when six hours have passed', async () => {
      const { sut, calls, clock } = setup({ latest: null });
      await sut.getAppInfo();
      await settle();
      clock.now = 7 * HOUR;

      await sut.getAppInfo();
      await settle();

      expect(calls.check).toBe(2);
    });

    it('should not look again when a version is downloading, however long it takes', async () => {
      const { sut, calls, clock } = setup();
      await sut.checkNow();
      clock.now = 20 * HOUR;

      await sut.getAppInfo();

      expect(calls.check).toBe(1);
    });
  });

  describe('checkNow', () => {
    it('should answer what GitHub says when the app cannot update itself', async () => {
      const { sut } = setup({ hasAuto: false });

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: true, info: MANUAL });
    });

    it('should start downloading the new version when the check finds one', async () => {
      const { sut, calls, changes } = setup();

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: true, info: downloading(0) });
      expect(calls).toMatchObject({ check: 1, download: 1 });
      expect(changes).toEqual([downloading(0)]);
    });

    it.each([
      { found: 'no release', latest: null },
      { found: 'the running version', latest: '1.0.0' },
      { found: 'an older version', latest: '0.9.0' },
    ])(
      'should answer that nothing is new and download nothing when the check finds $found',
      async ({ latest }) => {
        const { sut, calls, changes } = setup({ latest });

        const answer = await sut.checkNow();

        expect(answer).toEqual({ ok: true, info: NOTHING });
        expect(calls.download).toBe(0);
        expect(changes).toEqual([]);
      },
    );

    it('should point to the download page when the install of the version found already failed', async () => {
      // The app closed itself to install 1.1.0 and is still 1.0.0.
      const { sut, calls } = setup({ attempted: '1.1.0' });

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: true, info: MANUAL });
      expect(calls.download).toBe(0);
    });

    it('should keep pointing to the download page when asked again after a failed install', async () => {
      const { sut, calls } = setup({ attempted: '1.1.0' });
      await sut.checkNow();

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: true, info: MANUAL });
      expect(calls.download).toBe(0);
    });

    it('should download a version later than the one whose install failed', async () => {
      const { sut, calls } = setup({ attempted: '1.1.0', latest: '1.2.0' });

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: true, info: downloading(0, '1.2.0') });
      expect(calls.download).toBe(1);
    });

    it('should not look again when a version is downloading, however long it takes', async () => {
      const { sut, calls, clock } = setup();
      await sut.checkNow();
      clock.now = 20 * HOUR;

      await sut.checkNow();

      expect(calls.check).toBe(1);
    });

    it('should share one look when two checks are made at the same time', async () => {
      const { sut, calls } = setup();

      await Promise.all([sut.checkNow(), sut.checkNow()]);

      expect(calls).toMatchObject({ check: 1, download: 1 });
    });

    it('should answer through GitHub when the automatic check cannot be made', async () => {
      const { sut, net } = setup();
      net.online = false;

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: false, info: MANUAL });
    });

    it('should try the automatic update again when the previous check failed', async () => {
      const { sut, calls, net } = setup();
      net.online = false;
      await sut.checkNow();
      net.online = true;

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: true, info: downloading(0) });
      expect(calls.check).toBe(2);
    });

    it.each([
      { found: 'no release', latest: null },
      { found: 'the running version', latest: '1.0.0' },
    ])(
      'should forget the version whose download failed when a later check finds $found',
      async ({ latest }) => {
        // 1.1.0 was withdrawn after its download failed.
        const { sut, net, emit } = setup();
        await sut.checkNow();
        emit().onError('checksum mismatch');
        await settle();
        net.latest = latest;

        const answer = await sut.checkNow();

        expect(answer).toEqual({ ok: true, info: NOTHING });
      },
    );

    it('should download the new version when the system cannot say whether it would refuse to install it', async () => {
      const { sut } = setup({ isBlocked: 'unknown' });

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: true, info: downloading(0) });
    });

    it('should ask the system once whether it would refuse the install when it is asked for news several times', async () => {
      const { sut, calls } = setup();
      await sut.checkNow();
      await sut.getAppInfo();

      await sut.checkNow();

      expect(calls.blocked).toBe(1);
    });

    it('should point to the download page when the download of the version found cannot be made', async () => {
      const { sut, changes, net } = setup();
      net.canDownload = false;

      await sut.checkNow();
      await settle();

      expect(changes).toEqual([downloading(0), MANUAL]);
    });

    it('should start the next download from zero when the one before it failed halfway', async () => {
      const { sut, emit } = setup();
      await sut.checkNow();
      emit().onProgress(50);
      emit().onError('connection lost');
      await settle();

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: true, info: downloading(0) });
    });

    it('should answer the new version as blocked, downloading nothing, when the system would refuse to install it', async () => {
      const { sut, calls } = setup({ isBlocked: true });

      const answer = await sut.checkNow();

      expect(answer).toEqual({ ok: true, info: BLOCKED });
      expect(calls).toMatchObject({ check: 0, download: 0 });
    });
  });

  describe('install', () => {
    it('should leave the recorded attempt alone when the app cannot update itself', () => {
      const { sut, attempt } = setup({ hasAuto: false, attempted: '1.1.0' });

      sut.install();

      expect(attempt.version).toBe('1.1.0');
    });

    it('should not install when no version was found', () => {
      const { sut, calls, attempt } = setup();

      sut.install();

      expect(calls.install).toBe(0);
      expect(attempt.version).toBeNull();
    });

    it('should not install when the version is still downloading', async () => {
      const { sut, calls, attempt } = setup();
      await sut.checkNow();

      sut.install();

      expect(calls.install).toBe(0);
      expect(attempt.version).toBeNull();
    });

    it('should not install when the system would refuse the version, which was never downloaded', async () => {
      const { sut, calls, attempt } = setup({ isBlocked: true });
      await sut.checkNow();

      sut.install();

      expect(calls.install).toBe(0);
      expect(attempt.version).toBeNull();
    });

    it('should install the downloaded version, recording which one it closed for', async () => {
      const { sut, calls, attempt, emit } = setup();
      await sut.checkNow();
      emit().onReady('1.1.0');

      sut.install();

      expect(calls.install).toBe(1);
      expect(attempt.version).toBe('1.1.0');
    });
  });

  describe('updater events', () => {
    it('should announce the progress only when the whole number changes', async () => {
      const { sut, changes, emit } = setup();
      await sut.checkNow();

      for (const percent of [0.4, 12.2, 12.9, 13.1, 100]) {
        emit().onProgress(percent);
      }

      expect(changes).toEqual([
        downloading(0),
        downloading(12),
        downloading(13),
        downloading(100),
      ]);
    });

    it('should announce the version as ready when its download finishes', async () => {
      const { sut, changes, emit } = setup();
      await sut.checkNow();

      emit().onReady('1.1.0');

      expect(changes).toEqual([downloading(0), READY]);
    });

    it('should ignore progress reported after the download finished', async () => {
      const { sut, changes, emit } = setup();
      await sut.checkNow();
      emit().onReady('1.1.0');

      emit().onProgress(50);

      expect(changes).toEqual([downloading(0), READY]);
    });

    it('should fall back to the download page when the updater reports an error', async () => {
      const { sut, changes, emit } = setup();
      await sut.checkNow();

      emit().onError('checksum mismatch');
      await settle();

      expect(changes).toEqual([downloading(0), MANUAL]);
    });

    it.each([
      { reported: -5, shown: 0 },
      { reported: 100.4, shown: 100 },
      { reported: 250, shown: 100 },
    ])(
      'should announce $shown percent when the updater reports $reported',
      async ({ reported, shown }) => {
        const { sut, changes, emit } = setup();
        await sut.checkNow();
        emit().onProgress(50);

        emit().onProgress(reported);

        expect(changes.at(-1)).toEqual(downloading(shown));
      },
    );

    it('should point to the download page once when the updater reports a second error', async () => {
      const { sut, changes, emit } = setup();
      await sut.checkNow();
      emit().onError('checksum mismatch');

      emit().onError('checksum mismatch');
      await settle();

      expect(changes).toEqual([downloading(0), MANUAL]);
    });

    it('should log the error the updater reports', async () => {
      const { sut, logged, emit } = setup();
      await sut.checkNow();

      emit().onError('checksum mismatch');

      expect(logged).toEqual(['checksum mismatch']);
    });
  });
});
