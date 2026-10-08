import { describe, expect, it } from 'vitest';

import { type UpdateStatus } from '@shared/types/AppInfo';
import { isUpdatingItself, needsTheUser } from '@shared/updateFlow';
import { makeAppInfo } from '@test/factories/makeAppInfo';

const info = (
  updateStatus: UpdateStatus,
  newVersion: string | null = '1.1.0',
) => makeAppInfo({ updateStatus, newVersion });

describe('update flow', () => {
  it.each([
    {
      state: 'a version downloading',
      appInfo: info('downloading'),
      holds: true,
    },
    { state: 'a version ready', appInfo: info('ready'), holds: true },
    {
      state: 'a version to fetch by hand',
      appInfo: info('manual'),
      holds: false,
    },
    {
      state: 'a version the system blocks',
      appInfo: info('blocked'),
      holds: false,
    },
    // The automatic path with nothing found reports `downloading` and no version.
    {
      state: 'nothing found',
      appInfo: info('downloading', null),
      holds: false,
    },
    { state: 'nothing known yet', appInfo: null, holds: false },
  ])(
    'with $state, holding the app to update is $holds',
    ({ appInfo, holds }) => {
      expect(isUpdatingItself(appInfo)).toBe(holds);
    },
  );

  it.each([
    {
      state: 'a version to fetch by hand',
      appInfo: info('manual'),
      tells: true,
    },
    {
      state: 'a version the system blocks',
      appInfo: info('blocked'),
      tells: true,
    },
    {
      state: 'a version downloading',
      appInfo: info('downloading'),
      tells: false,
    },
    { state: 'nothing found', appInfo: info('manual', null), tells: false },
    { state: 'nothing known yet', appInfo: null, tells: false },
  ])('with $state, telling the user is $tells', ({ appInfo, tells }) => {
    expect(needsTheUser(appInfo)).toBe(tells);
  });
});
