import { statSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { type IAccount } from '@shared/types/Account';
import { fakeSteamClient } from '@tests/fakeSteamClient';
import { KEY, makeTempDir, STEAM_ID } from '@tests/helpers';
import { InMemoryStore } from '@tests/InMemoryStore';

import {
  type ICredentials,
  type IRawPlayerSummary,
  SteamError,
} from '../steam/SteamClient';
import { Store } from '../storage/Store';

import { KeyStatus } from './KeyStatus';

/** Steam knows whoever is asked about, and calls them "player". */
const summary = ({ steamId }: ICredentials): IRawPlayerSummary => ({
  steamid: steamId,
  personaname: 'player',
  avatarfull: 'x',
});

/**
 * The key status of an app with one account, `STEAM_ID`, which it follows
 * and whose key Steam accepts, over the store it is given: one in memory,
 * unless the test is about the file. `changes` holds the accounts as they
 * were each time a change was announced.
 */
function setup(store: InMemoryStore | Store = new InMemoryStore()) {
  store.setCredentials(
    { steamId: STEAM_ID, apiKey: KEY },
    { steamId: STEAM_ID, name: 'player', avatar: 'x' },
  );
  const changes: IAccount[][] = [];
  const logErrorMock = vi.fn<(source: string, detail: string) => void>();
  const sut = new KeyStatus(
    store,
    fakeSteamClient({ summary }),
    () => changes.push(store.getAccounts()),
    logErrorMock,
  );
  return { store, sut, changes, logErrorMock };
}

/**
 * The same over the real `Store`, in the folder `dir`: for what only the
 * file it saves shows.
 */
function setupOnDisk() {
  const dir = makeTempDir();
  return { ...setup(new Store(dir)), dir };
}

describe('KeyStatus', () => {
  describe('attempt', () => {
    it('should keep the app open and mark the account when Steam starts rejecting its key', async () => {
      const { sut, store, changes } = setup();

      const result = await sut.attempt(() =>
        Promise.reject(new SteamError('invalid-key')),
      );

      expect(result).toEqual({
        ok: false,
        error: 'Steam rejected the Web API key.',
      });
      expect(store.getCredentials()).toEqual({
        steamId: STEAM_ID,
        apiKey: KEY,
      });
      expect(store.getAccounts()).toMatchObject([
        { steamId: STEAM_ID, status: 'rejected' },
      ]);
      expect(changes).toEqual([
        [expect.objectContaining({ status: 'rejected' })],
      ]);
    });

    it('should mark the account as limited when Steam asks it to slow down', async () => {
      const { sut, store } = setup();

      await sut.attempt(() => Promise.reject(new SteamError('rate-limited')));

      expect(store.getAccounts()[0].status).toBe('rateLimited');
    });

    it('should take the mark off when a read works again', async () => {
      const { sut, store } = setup();
      await sut.attempt(() => Promise.reject(new SteamError('rate-limited')));

      await sut.attempt(() => Promise.resolve('read'));

      expect(store.getAccounts()[0].status).toBe('valid');
    });

    it('should announce nothing when a read only confirms what was known', async () => {
      const { sut, changes } = setup();

      await sut.attempt(() => Promise.resolve('read'));

      expect(changes).toEqual([]);
    });

    it('should leave the account as it was when Steam cannot be reached', async () => {
      const { sut, store, changes } = setup();

      const result = await sut.attempt(() =>
        Promise.reject(new SteamError('network')),
      );

      expect(result).toEqual({
        ok: false,
        error: 'Could not reach Steam. Check your connection.',
      });
      expect(store.getAccounts()[0].status).toBe('valid');
      expect(changes).toEqual([]);
    });

    it('should hide the details of an unexpected error', async () => {
      const { sut, store, changes, logErrorMock } = setup();

      const result = await sut.attempt(() => Promise.reject(new Error('boom')));

      expect(result).toEqual({
        ok: false,
        error: 'Unexpected error. Try again.',
      });
      expect(store.getAccounts()[0].status).toBe('valid');
      expect(changes).toEqual([]);
      expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
        'main: steam read',
        expect.stringContaining('boom'),
      );
    });

    it.each(['invalid-key', 'network'] as const)(
      'should log nothing when the read fails with %s, which Steam is known to answer',
      async (kind) => {
        const { sut, logErrorMock } = setup();

        await sut.attempt(() => Promise.reject(new SteamError(kind)));

        expect(logErrorMock).not.toHaveBeenCalled();
      },
    );
  });

  describe('recheck', () => {
    it('should leave the saved file alone when Steam answers what was already known', async () => {
      const { sut, dir } = setupOnDisk();
      const file = join(dir, 'config.json');
      const before = new Date('2020-01-01T00:00:00Z');
      utimesSync(file, before, before);

      await sut.recheck(STEAM_ID);

      expect(statSync(file).mtime).toEqual(before);
    });

    it('should save the new status when Steam answers something else', async () => {
      const { sut, dir, store } = setupOnDisk();
      store.setAccountStatus(STEAM_ID, 'rejected');
      const file = join(dir, 'config.json');
      const before = new Date('2020-01-01T00:00:00Z');
      utimesSync(file, before, before);

      await sut.recheck(STEAM_ID);

      expect(statSync(file).mtime).not.toEqual(before);
    });
  });
});
