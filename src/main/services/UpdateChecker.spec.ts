import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeAppInfo } from '@tests/factories/makeAppInfo';
import { fakeFetch, type IRoute } from '@tests/helpers';

import { UpdateChecker } from './UpdateChecker';

const HOUR = 60 * 60 * 1000;

const LATER_RELEASE: IRoute = { json: { tag_name: 'v1.3.0' } };
const SAME_RELEASE: IRoute = { json: { tag_name: 'v1.2.0' } };
const RATE_LIMIT: IRoute = { status: 403, json: { message: 'rate limit' } };

interface ISetupOverrides {
  apiBase?: string;
  timeout?: () => AbortSignal;
}

/** Version 1.2.0 of `someone/app`, at time zero, with GitHub answering `route`. */
function setup(
  route: IRoute | (() => IRoute),
  overrides: ISetupOverrides = {},
) {
  const fetchImpl = fakeFetch({ '/releases/latest': route });
  const clock = { now: 0 };
  const sut = new UpdateChecker({
    currentVersion: '1.2.0',
    repository: 'someone/app',
    fetchImpl,
    now: () => clock.now,
    ...overrides,
  });
  return { sut, fetchImpl, clock };
}

describe('UpdateChecker', () => {
  describe('isDue', () => {
    it('should be due when no check was ever made', () => {
      const checkedAt = null;

      const isDue = UpdateChecker.isDue(checkedAt, 0);

      expect(isDue).toBe(true);
    });

    it.each([
      { age: 'just under six hours', elapsed: 6 * HOUR - 1, isExpected: false },
      { age: 'exactly six hours', elapsed: 6 * HOUR, isExpected: false },
      { age: 'just over six hours', elapsed: 6 * HOUR + 1, isExpected: true },
    ])(
      'should answer $isExpected when the last check is $age old',
      ({ elapsed, isExpected }) => {
        const checkedAt = 1000;

        const isDue = UpdateChecker.isDue(checkedAt, checkedAt + elapsed);

        expect(isDue).toBe(isExpected);
      },
    );
  });

  describe('getAppInfo', () => {
    it('should report the new version when a later release exists', async () => {
      const { sut } = setup(LATER_RELEASE);

      const info = await sut.getAppInfo();

      expect(info).toEqual(
        makeAppInfo({ version: '1.2.0', newVersion: '1.3.0' }),
      );
    });

    it('should report no new version when the running version is the latest', async () => {
      const { sut } = setup(SAME_RELEASE);

      const info = await sut.getAppInfo();

      expect(info).toEqual(makeAppInfo({ version: '1.2.0', newVersion: null }));
    });

    it('should ask GitHub for the latest release of the repository', async () => {
      const { sut, fetchImpl } = setup(LATER_RELEASE);

      await sut.getAppInfo();

      expect(fetchImpl.calls).toEqual([
        'https://api.github.com/repos/someone/app/releases/latest',
      ]);
    });

    it('should ask the address it was given when one replaces GitHub', async () => {
      const { sut, fetchImpl } = setup(LATER_RELEASE, {
        apiBase: 'http://127.0.0.1:9999/github',
      });

      await sut.getAppInfo();

      expect(fetchImpl.calls).toEqual([
        'http://127.0.0.1:9999/github/repos/someone/app/releases/latest',
      ]);
    });

    it('should make one request when it is called twice at the same time', async () => {
      const { sut, fetchImpl } = setup(LATER_RELEASE);

      await Promise.all([sut.getAppInfo(), sut.getAppInfo()]);

      expect(fetchImpl.calls).toHaveLength(1);
    });

    it('should not ask GitHub again when the last check is under six hours old', async () => {
      const { sut, fetchImpl, clock } = setup(LATER_RELEASE);
      await sut.getAppInfo();
      clock.now = 5 * HOUR;

      await sut.getAppInfo();

      expect(fetchImpl.calls).toHaveLength(1);
    });

    it('should ask GitHub again when the last check is over six hours old', async () => {
      const { sut, fetchImpl, clock } = setup(LATER_RELEASE);
      await sut.getAppInfo();
      clock.now = 7 * HOUR;

      await sut.getAppInfo();

      expect(fetchImpl.calls).toHaveLength(2);
    });

    it('should keep the last version found when a later check fails', async () => {
      let route = LATER_RELEASE;
      const { sut, clock } = setup(() => route);
      await sut.getAppInfo();
      route = RATE_LIMIT;
      clock.now = 7 * HOUR;

      const info = await sut.getAppInfo();

      expect(info).toEqual(
        makeAppInfo({ version: '1.2.0', newVersion: '1.3.0' }),
      );
    });

    it('should report no new version when the release it had found is no longer the latest', async () => {
      let route = LATER_RELEASE;
      const { sut, clock } = setup(() => route);
      await sut.getAppInfo();
      route = SAME_RELEASE;
      clock.now = 7 * HOUR;

      const info = await sut.getAppInfo();

      expect(info).toEqual(makeAppInfo({ version: '1.2.0', newVersion: null }));
    });

    it('should not ask GitHub again when the last check, which failed, is under six hours old', async () => {
      const { sut, fetchImpl, clock } = setup(RATE_LIMIT);
      await sut.getAppInfo();
      clock.now = 5 * HOUR;

      await sut.getAppInfo();

      expect(fetchImpl.calls).toHaveLength(1);
    });

    it('should not ask GitHub again when the last check, which could not reach it, is under six hours old', async () => {
      const { sut, fetchImpl, clock } = setup(() => {
        throw new TypeError('fetch failed');
      });
      await sut.getAppInfo();
      clock.now = 5 * HOUR;

      await sut.getAppInfo();

      expect(fetchImpl.calls).toHaveLength(1);
    });

    it('should ask GitHub for its JSON format', async () => {
      const { sut, fetchImpl } = setup(LATER_RELEASE);

      await sut.getAppInfo();

      expect(fetchImpl.inits.map((init) => init?.headers)).toEqual([
        { Accept: 'application/vnd.github+json' },
      ]);
    });
  });

  describe('check', () => {
    it('should answer true when GitHub answers with a release', async () => {
      const { sut } = setup(LATER_RELEASE);

      const hasChecked = await sut.check();

      expect(hasChecked).toBe(true);
    });

    it.each([
      { reason: 'no release yet', route: { status: 404, json: {} } },
      { reason: 'a rate limit', route: RATE_LIMIT },
      { reason: 'a server error', route: { status: 500, text: 'oops' } },
      { reason: 'an answer that is not JSON', route: { text: '<html>' } },
    ])('should answer false when GitHub has $reason', async ({ route }) => {
      const { sut } = setup(route);

      const hasChecked = await sut.check();

      expect(hasChecked).toBe(false);
    });

    it('should answer false when GitHub cannot be reached', async () => {
      const { sut } = setup(() => {
        throw new TypeError('fetch failed');
      });

      const hasChecked = await sut.check();

      expect(hasChecked).toBe(false);
    });

    describe('with the limit users get', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should give the request ten seconds when it was built with no limit of its own', async () => {
        const timeoutMock = vi.spyOn(AbortSignal, 'timeout');
        const { sut } = setup(LATER_RELEASE);

        await sut.check();

        expect(timeoutMock).toHaveBeenCalledExactlyOnceWith(10_000);
      });
    });

    it('should give the request the signal of its timeout when it asks GitHub', async () => {
      const { signal } = new AbortController();
      const { sut, fetchImpl } = setup(LATER_RELEASE, {
        timeout: () => signal,
      });

      await sut.check();

      expect(fetchImpl.inits).toHaveLength(1);
      expect(fetchImpl.inits[0]?.signal).toBe(signal);
    });

    it('should update the version when the last check is under six hours old', async () => {
      let route = SAME_RELEASE;
      const { sut, fetchImpl } = setup(() => route);
      await sut.getAppInfo();
      route = LATER_RELEASE;

      await sut.check();

      const info = await sut.getAppInfo();
      expect(info.newVersion).toBe('1.3.0');
      expect(fetchImpl.calls).toHaveLength(2);
    });
  });
});
