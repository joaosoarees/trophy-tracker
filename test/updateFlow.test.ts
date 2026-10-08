import { describe, expect, it } from 'vitest';

import { type IAppInfo, type UpdateStatus } from '../src/shared/types/AppInfo';
import { isUpdatingItself, needsTheUser } from '../src/shared/updateFlow';

const info = (
  updateStatus: UpdateStatus,
  newVersion: string | null = '1.1.0',
): IAppInfo => ({
  version: '1.0.0',
  newVersion,
  updateStatus,
  downloadPercent: null,
});

describe('update flow', () => {
  it('holds the app only for a version it is installing by itself', () => {
    expect(isUpdatingItself(info('downloading'))).toBe(true);
    expect(isUpdatingItself(info('ready'))).toBe(true);
    expect(isUpdatingItself(info('manual'))).toBe(false);
    expect(isUpdatingItself(info('blocked'))).toBe(false);
    // The automatic path with nothing found reports `downloading` and no version.
    expect(isUpdatingItself(info('downloading', null))).toBe(false);
    expect(isUpdatingItself(null)).toBe(false);
  });

  it('tells the user about a version only they can fetch', () => {
    expect(needsTheUser(info('manual'))).toBe(true);
    expect(needsTheUser(info('blocked'))).toBe(true);
    expect(needsTheUser(info('downloading'))).toBe(false);
    expect(needsTheUser(info('manual', null))).toBe(false);
    expect(needsTheUser(null)).toBe(false);
  });
});
