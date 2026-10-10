import { describe, expect, it } from 'vitest';

import { makeAppInfo } from '@tests/factories/makeAppInfo';
import { fakeFetch, type IRoute } from '@tests/helpers';

import { UpdateChecker } from './UpdateChecker';

const HOUR = 60 * 60 * 1000;

const LATER_RELEASE: IRoute = { json: { tag_name: 'v1.3.0' } };
const SAME_RELEASE: IRoute = { json: { tag_name: 'v1.2.0' } };
const RATE_LIMIT: IRoute = { status: 403, json: { message: 'rate limit' } };

interface ISetupOverrides {
  apiBase?: string;
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
