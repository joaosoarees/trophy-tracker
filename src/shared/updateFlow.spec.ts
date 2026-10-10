import { describe, expect, it } from 'vitest';

import { makeAppInfo } from '@tests/factories/makeAppInfo';

import { type UpdateStatus } from './types/AppInfo';
import { isUpdatingItself, needsTheUser } from './updateFlow';

/** Version 1.1.0 found, in the given state; pass `null` for no version found. */
const appInfoIn = (
  updateStatus: UpdateStatus,
  newVersion: string | null = '1.1.0',
) => makeAppInfo({ updateStatus, newVersion });

describe('updateFlow', () => {
  describe('isUpdatingItself', () => {
    it.each([
      { state: 'a version is downloading', info: appInfoIn('downloading') },
      { state: 'a version is ready', info: appInfoIn('ready') },
    ])('should answer true when $state', ({ info }) => {
      const isHolding = isUpdatingItself(info);

      expect(isHolding).toBe(true);
    });

    it.each([
      { state: 'a version is fetched by hand', info: appInfoIn('manual') },
      { state: 'the system blocks a version', info: appInfoIn('blocked') },
      { state: 'no version was found', info: appInfoIn('idle', null) },
      {
        state: 'a version is known and nothing is being fetched',
        info: appInfoIn('idle'),
      },
      {
        state: 'a download names no version',
        info: appInfoIn('downloading', null),
      },
      { state: 'nothing is known yet', info: null },
    ])('should answer false when $state', ({ info }) => {
      const isHolding = isUpdatingItself(info);

      expect(isHolding).toBe(false);
    });
  });

  describe('needsTheUser', () => {
    it.each([
      { state: 'a version is fetched by hand', info: appInfoIn('manual') },
      { state: 'the system blocks a version', info: appInfoIn('blocked') },
    ])('should answer true when $state', ({ info }) => {
      const isTelling = needsTheUser(info);

      expect(isTelling).toBe(true);
    });

    it.each([
      { state: 'a version is downloading', info: appInfoIn('downloading') },
      { state: 'a version is ready', info: appInfoIn('ready') },
      {
        state: 'a version is known and nothing is being fetched',
        info: appInfoIn('idle'),
      },
      { state: 'no version was found', info: appInfoIn('manual', null) },
      {
        state: 'the app found nothing to fetch',
        info: appInfoIn('idle', null),
      },
      { state: 'nothing is known yet', info: null },
    ])('should answer false when $state', ({ info }) => {
      const isTelling = needsTheUser(info);

      expect(isTelling).toBe(false);
    });
  });
});
