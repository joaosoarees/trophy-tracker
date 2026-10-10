import { statSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { type AccountStatus, type IAccount } from '@shared/types/Account';
import { type IGameView } from '@shared/types/Game';
import { fakeSteamClient } from '@tests/fakeSteamClient';
import nioh from '@tests/fixtures/game-achievements-3681010.json';
import {
  KEY,
  makeTempDir,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
} from '@tests/helpers';
import { InMemoryStore } from '@tests/InMemoryStore';
import { achieved, game } from '@tests/steamLibrary';

import {
  type ICredentials,
  type IRawPlayerAchievement,
  type IRawPlayerSummary,
  SteamError,
} from '../steam/SteamClient';
import { Store } from '../storage/Store';

import { KeyStatus } from './KeyStatus';
import { Tracker } from './Tracker';

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
function setup(
  store: InMemoryStore | Store = new InMemoryStore(),
  client = fakeSteamClient({ summary }),
) {
  store.setCredentials(
    { steamId: STEAM_ID, apiKey: KEY },
    { steamId: STEAM_ID, name: 'player', avatar: 'x' },
  );
  const changes: IAccount[][] = [];
  const logErrorMock = vi.fn<(source: string, detail: string) => void>();
  const sut = new KeyStatus(
    store,
    client,
    () => changes.push(store.getAccounts()),
    logErrorMock,
  );
  return { store, sut, client, changes, logErrorMock };
}

/** The same app, with Steam failing whoever asks for a profile. */
function setupFailingSteam(failure: Error) {
  return setup(
    new InMemoryStore(),
    fakeSteamClient({
      summary: () => {
        throw failure;
      },
    }),
  );
}

/**
 * The same app, its key last given `status`, over a disk that from then on
 * refuses whatever is written at once: the status of a key included. Steam
 * accepts the key unless the test gives another Steam.
 */
function setupRefusingDisk(
  status: AccountStatus,
  client = fakeSteamClient({ summary }),
) {
  const store = new InMemoryStore();
  const made = setup(store, client);
  store.setAccountStatus(STEAM_ID, status);
  store.refuseWrites();
  return made;
}

/**
 * The same over the real `Store`, in the folder `dir`: for what only the
 * file it saves shows.
 */
function setupOnDisk() {
  const dir = makeTempDir();
  return { ...setup(new Store(dir)), dir };
}

/**
 * The same app with the real `Tracker` reading for it, over the same store
 * and the same Steam: the account owns the game 7, which was read once and is
 * in the cache, and the game 8, which its cached dashboard lists (the fake
 * Steam has no achievement list for a game, only what the player has in it).
 * Steam then stopped accepting the key
 * (`revoke`), and a dashboard refresh marked the account `rejected`. `changes`
 * starts empty after that, and `advance` moves the tracker's clock.
 */
async function setupRevokedKey() {
  const store = new InMemoryStore();
  store.setCredentials(
    { steamId: STEAM_ID, apiKey: KEY },
    { steamId: STEAM_ID, name: 'player', avatar: 'x' },
  );
  let isRevoked = false;
  const refuseWhenRevoked = <T>(answer: T): T => {
    if (isRevoked) throw new SteamError('invalid-key');
    return answer;
  };
  const client = fakeSteamClient({
    summary,
    owned: () => refuseWhenRevoked([game(7, 'Game', 5), game(8, 'Other', 5)]),
    achievements: () => [],
    player: () => refuseWhenRevoked(achieved(1, 4)),
  });
  let now = 1_000_000;
  const tracker = new Tracker({
    store,
    client,
    readStatMap: () => Promise.resolve(new Map<string, string>()),
    now: () => now,
  });
  const changes: IAccount[][] = [];
  const sut = new KeyStatus(store, client, () =>
    changes.push(store.getAccounts()),
  );
  await tracker.getGame(7);
  await tracker.getDashboard();
  isRevoked = true;
  await sut.attempt((onAnswer) =>
    tracker.getDashboard('all', undefined, onAnswer),
  );
  changes.length = 0;
  client.asked.length = 0;
  return {
    sut,
    store,
    client,
    tracker,
    changes,
    advance: (ms: number): void => {
      now += ms;
    },
    restore: (): void => {
      isRevoked = false;
    },
  };
}

const NIOH = 3681010;

/** What a player has in Nioh 3: the first `count` achievements of the list. */
const niohUnlocked = (count: number): IRawPlayerAchievement[] =>
  nioh.response.achievements.slice(0, count).map((a) => ({
    apiname: a.internal_name,
    achieved: 1,
    unlocktime: 9,
  }));

/** One turn of the event loop: whatever was ready to run has run. */
const turn = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

/**
 * An app with two accounts whose keys Steam accepts, `STEAM_ID` in use, and
 * the real `Tracker` reading for it. Nioh 3 was read for `STEAM_ID` long
 * enough ago to be stale, so asking for it starts a refresh behind the
 * scenes, which Steam answers only when the test says how: `unlock` or
 * `refuseKey`. `open` asks for the game as the `getGame` handler of `Ipc`
 * does; `onFreshMock` is what that handler would send to the interface.
 */
async function setupStaleGame() {
  const store = new InMemoryStore();
  store.setCredentials(
    { steamId: OTHER_STEAM_ID, apiKey: OTHER_KEY },
    { steamId: OTHER_STEAM_ID, name: 'other', avatar: 'x' },
  );
  store.setCredentials(
    { steamId: STEAM_ID, apiKey: KEY },
    { steamId: STEAM_ID, name: 'player', avatar: 'x' },
  );
  let refresh: {
    resolve: (list: IRawPlayerAchievement[]) => void;
    reject: (e: unknown) => void;
  } | null = null;
  let isStale = false;
  const client = fakeSteamClient({
    summary,
    owned: () => [game(NIOH, 'Nioh 3', 500)],
    achievements: () => nioh.response.achievements,
    player: () =>
      isStale
        ? new Promise<IRawPlayerAchievement[]>((resolve, reject) => {
            refresh = { resolve, reject };
          })
        : niohUnlocked(1),
  });
  let now = 1_000_000;
  const tracker = new Tracker({
    store,
    client,
    readStatMap: () => Promise.resolve(new Map<string, string>()),
    now: () => now,
  });
  const sut = new KeyStatus(store, client);
  await tracker.getGame(NIOH);
  now += 5 * 60_000;
  isStale = true;
  const onFreshMock = vi.fn<(view: IGameView) => void>();
  const open = () =>
    sut.attempt((onAnswer, onFailure) =>
      tracker.getGameStaleFirst(NIOH, {
        onAnswer,
        onFresh: onFreshMock,
        onError: onFailure,
      }),
    );
  /** Steam answers the refresh, then everything that follows from it runs. */
  const unlock = async (count: number): Promise<void> => {
    refresh?.resolve(niohUnlocked(count));
    await turn();
  };
  const refuseKey = async (): Promise<void> => {
    refresh?.reject(new SteamError('invalid-key'));
    await turn();
  };
  const statuses = (): Record<string, string> =>
    Object.fromEntries(
      store.getAccounts().map(({ steamId, status }) => [steamId, status]),
    );
  return { sut, store, open, unlock, refuseKey, statuses, onFreshMock };
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
      const { sut, store, client, tracker, changes, restore } =
        await setupRevokedKey();
      restore();

      await sut.attempt((onAnswer) => tracker.getGame(7, true, onAnswer));

      expect(client.asked.map(({ method }) => method)).toContain(
        'getPlayerAchievements',
      );
      expect(store.getAccounts()[0].status).toBe('valid');
      expect(changes).toEqual([[expect.objectContaining({ status: 'valid' })]]);
    });

    it('should take the mark off when the refresh behind a stale game works again', async () => {
      const { sut, store, tracker, changes, advance, restore } =
        await setupRevokedKey();
      restore();
      advance(5 * 60_000);

      await sut.attempt((onAnswer) =>
        tracker.getGameStaleFirst(7, {
          onFresh: () => undefined,
          onError: () => undefined,
          onAnswer,
        }),
      );
      // Joins the refresh still in flight, so what follows sees how it ended.
      await tracker.getGame(7);

      expect(store.getAccounts()[0].status).toBe('valid');
      expect(changes).toEqual([[expect.objectContaining({ status: 'valid' })]]);
    });

    it('should leave a limited key marked when the read does not say Steam answered', async () => {
      const { sut, store, changes } = setup();
      await sut.attempt(() => Promise.reject(new SteamError('rate-limited')));

      await sut.attempt(() => Promise.resolve('read'));

      expect(store.getAccounts()[0].status).toBe('rateLimited');
      expect(changes).toEqual([
        [expect.objectContaining({ status: 'rateLimited' })],
      ]);
    });

    it('should keep a rejected key marked when a game is answered from the cache', async () => {
      const { sut, store, client, tracker, changes } = await setupRevokedKey();

      const result = await sut.attempt((onAnswer) =>
        tracker.getGame(7, false, onAnswer),
      );

      expect(result).toMatchObject({ ok: true, value: { appid: 7 } });
      expect(client.asked).toEqual([]);
      expect(store.getAccounts()[0].status).toBe('rejected');
      expect(changes).toEqual([]);
    });

    it('should keep a rejected key marked when the dashboard is answered from the cache', async () => {
      const { sut, store, client, tracker, changes } = await setupRevokedKey();

      const result = await sut.attempt((onAnswer) =>
        tracker.getDashboard('cached', undefined, onAnswer),
      );

      expect(result).toMatchObject({ ok: true, value: [{ appid: 8 }] });
      expect(client.asked).toEqual([]);
      expect(store.getAccounts()[0].status).toBe('rejected');
      expect(changes).toEqual([]);
    });

    it('should keep a rejected key marked throughout when the refresh behind a stale game fails', async () => {
      const { sut, store, client, tracker, changes, advance } =
        await setupRevokedKey();
      const onErrorMock = vi.fn<(e: unknown) => void>();
      advance(5 * 60_000);

      const result = await sut.attempt((onAnswer, onFailure) =>
        tracker.getGameStaleFirst(7, {
          onFresh: () => undefined,
          onError: (e) => {
            onErrorMock(e);
            onFailure(e);
          },
          onAnswer,
        }),
      );
      await vi.waitFor(() =>
        expect(onErrorMock).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ kind: 'invalid-key' }),
        ),
      );

      expect(result).toMatchObject({ ok: true, value: { appid: 7 } });
      expect(client.asked.map(({ method }) => method)).toEqual([
        'getPlayerAchievements',
      ]);
      expect(store.getAccounts()[0].status).toBe('rejected');
      expect(changes).toEqual([]);
    });

    it('should mark the account a stale game was read for when its refresh fails after another account took over', async () => {
      const { store, open, refuseKey, statuses } = await setupStaleGame();
      await open();
      store.setActiveAccount(OTHER_STEAM_ID);

      await refuseKey();

      expect(statuses()).toEqual({
        [STEAM_ID]: 'rejected',
        [OTHER_STEAM_ID]: 'valid',
      });
    });

    it('should not hand the interface the view a refresh found when another account took over meanwhile', async () => {
      const { store, open, unlock, onFreshMock } = await setupStaleGame();
      await open();
      store.setActiveAccount(OTHER_STEAM_ID);

      await unlock(3);

      expect(onFreshMock).not.toHaveBeenCalled();
    });

    it('should hand the interface the view a refresh found when the account is still in use', async () => {
      const { open, unlock, onFreshMock } = await setupStaleGame();
      await open();

      await unlock(3);

      expect(onFreshMock).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ appid: NIOH, unlockedCount: 3 }),
      );
    });

    it('should announce nothing when a read only confirms what was known', async () => {
      const { sut, changes } = setup();

      await sut.attempt((onAnswer) => {
        onAnswer();
        return Promise.resolve('read');
      });

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

  describe('a status the disk refuses to write', () => {
    it('should answer what was read when the key that worked cannot be marked valid again', async () => {
      const { sut } = setupRefusingDisk('rejected');

      const result = await sut.attempt((onAnswer) => {
        onAnswer();
        return Promise.resolve('read');
      });

      expect(result).toEqual({ ok: true, value: 'read' });
    });

    it('should answer what Steam said when the key it rejected cannot be marked', async () => {
      const { sut } = setupRefusingDisk('valid');

      const result = await sut.attempt(() =>
        Promise.reject(new SteamError('invalid-key')),
      );

      expect(result).toEqual({
        ok: false,
        error: 'Steam rejected the Web API key.',
      });
    });

    it('should keep the status the file has and announce no change when another cannot be written', async () => {
      const { sut, store, changes } = setupRefusingDisk('valid');

      await sut.attempt(() => Promise.reject(new SteamError('invalid-key')));

      expect(store.getAccounts()[0].status).toBe('valid');
      expect(changes).toEqual([]);
    });

    it('should write to the error log that the status could not be saved when a read learns another', async () => {
      const { sut, logErrorMock } = setupRefusingDisk('rateLimited');

      await sut.attempt(() => Promise.reject(new SteamError('invalid-key')));

      expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
        'main: key status',
        expect.stringContaining('InMemoryStore: the write was refused'),
      );
    });
  });

  describe('a recheck whose answer the disk refuses to write', () => {
    it('should say the status could not be saved when Steam answers another', async () => {
      const { sut } = setupRefusingDisk('rateLimited');

      const recheckPromise = sut.recheck(STEAM_ID);

      await expect(recheckPromise).rejects.toThrow(
        new Error('InMemoryStore: the write was refused'),
      );
    });

    it('should say the status could not be saved when Steam refuses a key the file has as valid', async () => {
      const { sut } = setupRefusingDisk(
        'valid',
        fakeSteamClient({
          summary: () => {
            throw new SteamError('invalid-key');
          },
        }),
      );

      const recheckPromise = sut.recheck(STEAM_ID);

      await expect(recheckPromise).rejects.toThrow(
        new Error('InMemoryStore: the write was refused'),
      );
    });

    it('should keep the status the file has when Steam answers another', async () => {
      const { sut, store } = setupRefusingDisk('rateLimited');

      await sut.recheck(STEAM_ID).catch(() => undefined);

      expect(store.getAccounts()[0].status).toBe('rateLimited');
    });

    it('should leave the error log to whoever asked when Steam answers another', async () => {
      const { sut, logErrorMock } = setupRefusingDisk('rateLimited');

      await sut.recheck(STEAM_ID).catch(() => undefined);

      expect(logErrorMock).not.toHaveBeenCalled();
    });

    it('should end without failing when Steam answers what was already known', async () => {
      const { sut } = setupRefusingDisk('valid');

      const outcome = await sut.recheck(STEAM_ID).then(
        () => 'ended',
        (e: unknown) => `rejected: ${String(e)}`,
      );

      expect(outcome).toBe('ended');
    });
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

    it.each([
      { kind: 'invalid-key', status: 'rejected' },
      { kind: 'rate-limited', status: 'rateLimited' },
    ] as const)(
      'should mark the account as $status when Steam answers $kind about its key',
      async ({ kind, status }) => {
        const { sut, store } = setupFailingSteam(new SteamError(kind));

        await sut.recheck(STEAM_ID);

        expect(store.getAccounts()[0].status).toBe(status);
      },
    );

    it('should take the mark off the account when Steam accepts its key again', async () => {
      const { sut, store } = setup();
      store.setAccountStatus(STEAM_ID, 'rejected');

      await sut.recheck(STEAM_ID);

      expect(store.getAccounts()[0].status).toBe('valid');
    });

    it.each(['valid', 'rejected', 'rateLimited'] as const)(
      'should leave the account as %s when Steam cannot be reached',
      async (status) => {
        const { sut, store } = setupFailingSteam(new SteamError('network'));
        store.setAccountStatus(STEAM_ID, status);

        await sut.recheck(STEAM_ID);

        expect(store.getAccounts()[0].status).toBe(status);
      },
    );

    it('should ask Steam about the account with the key saved for it', async () => {
      const { sut, client } = setup();

      await sut.recheck(STEAM_ID);

      expect(client.asked).toEqual([
        {
          method: 'getPlayerSummary',
          credentials: { steamId: STEAM_ID, apiKey: KEY },
        },
      ]);
    });

    it('should ask Steam nothing when the app does not have the account', async () => {
      const { sut, client } = setup();

      await sut.recheck(OTHER_STEAM_ID);

      expect(client.asked).toEqual([]);
    });

    it('should announce no change when it finds another status, which the answer of the recheck carries', async () => {
      const { sut, changes } = setupFailingSteam(new SteamError('invalid-key'));

      await sut.recheck(STEAM_ID);

      expect(changes).toEqual([]);
    });

    it('should log the error and leave the account as it was when the recheck fails unexpectedly', async () => {
      const { sut, store, logErrorMock } = setupFailingSteam(new Error('boom'));

      await sut.recheck(STEAM_ID);

      expect(store.getAccounts()[0].status).toBe('valid');
      expect(logErrorMock).toHaveBeenCalledExactlyOnceWith(
        'main: steam read',
        expect.stringContaining('boom'),
      );
    });
  });
});
