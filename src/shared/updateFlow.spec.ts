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
      isHolding: true,
    },
    { state: 'a version ready', appInfo: info('ready'), isHolding: true },
    {
      state: 'a version to fetch by hand',
      appInfo: info('manual'),
      isHolding: false,
    },
    {
      state: 'a version the system blocks',
      appInfo: info('blocked'),
      isHolding: false,
    },
    // The automatic path with nothing found reports `downloading` and no version.
    {
      state: 'nothing found',
      appInfo: info('downloading', null),
      isHolding: false,
    },
    { state: 'nothing known yet', appInfo: null, isHolding: false },
  ])(
    'with $state, holding the app to update is $isHolding',
    ({ appInfo, isHolding }) => {
      expect(isUpdatingItself(appInfo)).toBe(isHolding);
    },
  );

  it.each([
    {
      state: 'a version to fetch by hand',
      appInfo: info('manual'),
      isTelling: true,
    },
    {
      state: 'a version the system blocks',
      appInfo: info('blocked'),
      isTelling: true,
    },
    {
      state: 'a version downloading',
      appInfo: info('downloading'),
      isTelling: false,
    },
    { state: 'nothing found', appInfo: info('manual', null), isTelling: false },
    { state: 'nothing known yet', appInfo: null, isTelling: false },
  ])(
    'with $state, telling the user is $isTelling',
    ({ appInfo, isTelling }) => {
      expect(needsTheUser(appInfo)).toBe(isTelling);
    },
  );
});
