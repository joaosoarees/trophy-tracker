import { describe, expect, it } from 'vitest';

import { UpdateChecker } from '@main/services/UpdateChecker';
import { fakeFetch, type IRoute } from '@test/helpers';

const HOUR = 60 * 60 * 1000;

function setup(route: IRoute | (() => IRoute)) {
  const fetchImpl = fakeFetch({ '/releases/latest': route });
  const clock = { now: 0 };
  const checker = new UpdateChecker({
    currentVersion: '1.2.0',
    repository: 'someone/app',
    fetchImpl,
    now: () => clock.now,
  });
  return { checker, fetchImpl, clock };
}

describe('UpdateChecker', () => {
  it('reports a later release', async () => {
    const { checker, fetchImpl } = setup({ json: { tag_name: 'v1.3.0' } });
    expect(await checker.getAppInfo()).toEqual({
      version: '1.2.0',
      newVersion: '1.3.0',
      updateStatus: 'manual',
      downloadPercent: null,
    });
    expect(fetchImpl.calls).toEqual([
      'https://api.github.com/repos/someone/app/releases/latest',
    ]);
  });

  it('reports nothing when the running version is the latest', async () => {
    const { checker } = setup({ json: { tag_name: 'v1.2.0' } });
    expect((await checker.getAppInfo()).newVersion).toBeNull();
  });

  it('treats a missing release, an error and bad JSON as nothing new', async () => {
    for (const route of [
      { status: 404, json: { message: 'Not Found' } },
      { status: 403, json: { message: 'rate limit' } },
      { text: '<html>' },
    ]) {
      const { checker } = setup(route);
      expect((await checker.getAppInfo()).newVersion).toBeNull();
    }
  });

  it('asks GitHub once, however many times and however fast it is asked', async () => {
    const { checker, fetchImpl, clock } = setup({
      json: { tag_name: 'v1.3.0' },
    });
    await Promise.all([checker.getAppInfo(), checker.getAppInfo()]);
    clock.now = 5 * HOUR;
    await checker.getAppInfo();
    expect(fetchImpl.calls).toHaveLength(1);

    clock.now = 7 * HOUR;
    await checker.getAppInfo();
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it('checks on request, saying whether the check could be made', async () => {
    let route: IRoute = { json: { tag_name: 'v1.2.0' } };
    const { checker, fetchImpl } = setup(() => route);
    await checker.getAppInfo();

    route = { json: { tag_name: 'v1.3.0' } };
    expect(await checker.check()).toBe(true);
    expect((await checker.getAppInfo()).newVersion).toBe('1.3.0');
    expect(fetchImpl.calls).toHaveLength(2);

    route = { status: 500, text: 'oops' };
    expect(await checker.check()).toBe(false);
  });

  it('keeps the last answer when a later check fails', async () => {
    let route: IRoute = { json: { tag_name: 'v1.3.0' } };
    const { checker, clock } = setup(() => route);
    await checker.getAppInfo();

    route = { status: 500, text: 'oops' };
    clock.now = 7 * HOUR;
    expect((await checker.getAppInfo()).newVersion).toBe('1.3.0');
  });
});
