import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeGameView } from '@tests/factories/makeGameView';
import {
  KEY,
  makeTempDir,
  OTHER_KEY,
  OTHER_STEAM_ID,
  STEAM_ID,
  UNKNOWN_STEAM_ID,
} from '@tests/helpers';

import { type ICipher, type IStoreOptions, Store } from './Store';

const CREDENTIALS = { steamId: STEAM_ID, apiKey: KEY };
const PROFILE = { steamId: STEAM_ID, name: 'player', avatar: '' };
const OTHER_CREDENTIALS = { steamId: OTHER_STEAM_ID, apiKey: OTHER_KEY };
const OTHER_PROFILE = { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' };
const NOTE = { note: 'mine', pinned: false };
const SUMMARY = { total: 4, unlocked: 1, playtime: 10 };
const CHECKLIST = [{ id: '1', text: 'Bridge Kodama', done: true }];
const BOUNDS = { x: 2000, y: 100, width: 640, height: 900 };
const CACHE_DELAY = 1000;

/** A cipher that "encrypts" by prefixing the text, so the result is checkable. */
const CIPHER: ICipher = {
  encrypt: (plain) => `enc:${plain}`,
  decrypt: (encoded) => encoded.slice(4),
};

interface ISetupOverrides {
  /** The data folder; by default a new, empty one. */
  dir?: string;
  cipher?: ICipher | null;
  options?: IStoreOptions;
}

/** A store over a folder of its own, with no account. */
function setup({
  dir = makeTempDir(),
  cipher = null,
  options,
}: ISetupOverrides = {}) {
  const sut = new Store(dir, cipher, options);
  return { sut, dir };
}

/** A store that already has an account: notes are always somebody's. */
function setupWithAccount() {
  const { sut, dir } = setup();
  sut.setCredentials(CREDENTIALS, PROFILE);
  return { sut, dir };
}

/** Two accounts; the second one added is the one in use. */
function setupWithTwoAccounts() {
  const { sut, dir } = setupWithAccount();
  sut.setCredentials(OTHER_CREDENTIALS, OTHER_PROFILE);
  return { sut, dir };
}

/** A data folder a store has already saved an account in, and left. */
function makeAccountDir(): string {
  const dir = makeTempDir();
  new Store(dir).setCredentials(CREDENTIALS, PROFILE);
  return dir;
}

const filesEnding = (dir: string, suffix: string): string[] =>
  readdirSync(dir).filter((file) => file.endsWith(suffix));

describe('Store', () => {
  describe('credentials', () => {
    // Windows has no permission bits; there the user's profile folder is
    // what keeps other accounts out.
    it.skipIf(process.platform === 'win32')(
      'should write the key to a file only the user can read when an account is saved',
      () => {
        const { sut, dir } = setup();

        sut.setCredentials(CREDENTIALS, PROFILE);

        const mode = statSync(join(dir, 'config.json')).mode & 0o777;
        expect(mode).toBe(0o600);
      },
    );

    it('should answer the saved credentials when the folder is opened again', () => {
      const { sut, dir } = setup();

      sut.setCredentials(CREDENTIALS, PROFILE);

      const reopened = new Store(dir);
      expect(reopened.getCredentials()).toEqual(CREDENTIALS);
    });

    it('should answer the saved profile when the folder is opened again', () => {
      const { sut, dir } = setup();

      sut.setCredentials(CREDENTIALS, PROFILE);

      const reopened = new Store(dir);
      expect(reopened.getProfile()).toEqual(PROFILE);
    });

    it('should not answer a key saved with a cipher when the folder is opened without it', () => {
      const { sut, dir } = setup({ cipher: CIPHER });

      sut.setCredentials(CREDENTIALS, PROFILE);

      const reopenedWithoutCipher = new Store(dir);
      expect(reopenedWithoutCipher.getCredentials()).toBeNull();
    });

    it('should answer a key saved with a cipher when the folder is opened with it', () => {
      const { sut, dir } = setup({ cipher: CIPHER });

      sut.setCredentials(CREDENTIALS, PROFILE);

      const reopened = new Store(dir, CIPHER);
      expect(reopened.getCredentials()).toEqual(CREDENTIALS);
    });
  });

  describe('accounts', () => {
    it('should list the accounts without their keys when two are saved', () => {
      const { sut } = setupWithTwoAccounts();

      const accounts = sut.getAccounts();

      expect(accounts).toEqual([
        {
          ...PROFILE,
          keyEnding: KEY.slice(-4),
          isKeyEncrypted: false,
          status: 'valid',
        },
        {
          ...OTHER_PROFILE,
          keyEnding: OTHER_KEY.slice(-4),
          isKeyEncrypted: false,
          status: 'valid',
        },
      ]);
    });

    it('should list a key as encrypted when a cipher is available', () => {
      const { sut } = setup({ cipher: CIPHER });
      sut.setCredentials(CREDENTIALS, PROFILE);

      const accounts = sut.getAccounts();

      expect(accounts).toEqual([
        {
          ...PROFILE,
          keyEnding: KEY.slice(-4),
          isKeyEncrypted: true,
          status: 'valid',
        },
      ]);
    });

    it('should answer the credentials of the account that was chosen when the folder is opened again', () => {
      const { sut, dir } = setupWithTwoAccounts();

      sut.setActiveAccount(STEAM_ID);

      const reopened = new Store(dir);
      expect(reopened.getCredentials()).toEqual(CREDENTIALS);
    });

    it('should refuse to follow an account when it has no key for it', () => {
      const { sut } = setupWithTwoAccounts();

      const isFollowing = sut.setActiveAccount(UNKNOWN_STEAM_ID);

      expect(isFollowing).toBe(false);
    });

    it('should stay on the account in use when asked to follow one it has no key for', () => {
      const { sut } = setupWithTwoAccounts();

      sut.setActiveAccount(UNKNOWN_STEAM_ID);

      expect(sut.getActiveSteamId()).toBe(OTHER_STEAM_ID);
    });

    it('should not answer the summary read for one account when another is followed', () => {
      const { sut } = setupWithTwoAccounts();
      sut.setSummaries({ 10: SUMMARY });

      sut.setActiveAccount(STEAM_ID);

      expect(sut.getSummary(10)).toBeNull();
    });

    it('should answer the summary read for an account when it is followed again', () => {
      const { sut } = setupWithTwoAccounts();
      sut.setSummaries({ 10: SUMMARY });
      sut.setActiveAccount(STEAM_ID);

      sut.setActiveAccount(OTHER_STEAM_ID);

      expect(sut.getSummary(10)).toEqual(SUMMARY);
    });

    it('should not hand a late read to the account in use when it was made for another', () => {
      const { sut } = setupWithTwoAccounts();

      sut.setSummaries({ 10: SUMMARY }, STEAM_ID);

      expect(sut.getSummary(10)).toBeNull();
    });

    it('should hand a late read to the account it was made for when that one is followed', () => {
      const { sut } = setupWithTwoAccounts();
      sut.setSummaries({ 10: SUMMARY }, STEAM_ID);

      sut.setActiveAccount(STEAM_ID);

      expect(sut.getSummary(10)).toEqual(SUMMARY);
    });

    it('should drop a late read when the account it was made for was removed', () => {
      const { sut, dir } = setupWithTwoAccounts();
      sut.removeAccount(STEAM_ID);

      sut.setSummaries({ 10: SUMMARY }, STEAM_ID);

      const cache = readFileSync(join(dir, 'cache.json'), 'utf8');
      expect(cache).not.toContain(STEAM_ID);
    });

    it('should not answer the notes written for one account when another is followed', () => {
      const { sut } = setupWithTwoAccounts();
      sut.setUserData(10, 'A', NOTE);

      sut.setActiveAccount(STEAM_ID);

      expect(sut.getUserData(10)).toEqual({});
    });

    it('should answer the notes written for an account when it is followed again', () => {
      const { sut } = setupWithTwoAccounts();
      sut.setUserData(10, 'A', NOTE);
      sut.setActiveAccount(STEAM_ID);

      sut.setActiveAccount(OTHER_STEAM_ID);

      expect(sut.getUserData(10)).toEqual({ A: NOTE });
    });

    it.each(['config.json', 'cache.json', 'userdata.json'])(
      'should leave nothing of an account in %s when it is removed',
      (file) => {
        const { sut, dir } = setupWithTwoAccounts();
        sut.setUserData(10, 'A', NOTE);
        sut.setSummaries({ 10: SUMMARY });

        sut.removeAccount(OTHER_STEAM_ID);

        const content = readFileSync(join(dir, file), 'utf8');
        expect(content).not.toContain(OTHER_STEAM_ID);
      },
    );

    it('should follow another account when the one in use is removed', () => {
      const { sut } = setupWithTwoAccounts();

      sut.removeAccount(OTHER_STEAM_ID);

      expect(sut.getActiveSteamId()).toBe(STEAM_ID);
    });

    it('should answer the new key when an account that is already there is saved again', () => {
      const { sut } = setupWithTwoAccounts();

      sut.setCredentials(
        { steamId: OTHER_STEAM_ID, apiKey: KEY },
        OTHER_PROFILE,
      );

      expect(sut.getCredentials()).toEqual({
        steamId: OTHER_STEAM_ID,
        apiKey: KEY,
      });
    });

    it('should list an account once when it is saved again', () => {
      const { sut } = setupWithTwoAccounts();

      sut.setCredentials(
        { steamId: OTHER_STEAM_ID, apiKey: KEY },
        OTHER_PROFILE,
      );

      const steamIds = sut.getAccounts().map((account) => account.steamId);
      expect(steamIds).toEqual([STEAM_ID, OTHER_STEAM_ID]);
    });

    it('should keep the notes of an account when it is saved again', () => {
      const { sut } = setupWithTwoAccounts();
      sut.setUserData(10, 'A', NOTE);

      sut.setCredentials(
        { steamId: OTHER_STEAM_ID, apiKey: KEY },
        OTHER_PROFILE,
      );

      expect(sut.getUserData(10)).toEqual({ A: NOTE });
    });

    it('should list the status Steam last gave a key when the folder is opened again', () => {
      const { sut, dir } = setupWithAccount();

      sut.setAccountStatus(STEAM_ID, 'rejected');

      const reopened = new Store(dir);
      expect(reopened.getAccounts()).toEqual([
        {
          ...PROFILE,
          keyEnding: KEY.slice(-4),
          isKeyEncrypted: false,
          status: 'rejected',
        },
      ]);
    });
  });

  describe('language', () => {
    it('should answer English when no language was chosen', () => {
      const { sut } = setup();

      const language = sut.getLanguage();

      expect(language).toBe('en');
    });

    it('should answer the chosen language when the folder is opened again', () => {
      const { sut, dir } = setup();

      sut.setLanguage('pt-BR');

      const reopened = new Store(dir);
      expect(reopened.getLanguage()).toBe('pt-BR');
    });

    it.each([
      {
        what: 'achievement list',
        read: (store: Store) => store.getSchema(1),
      },
      { what: 'game', read: (store: Store) => store.getGame(1) },
      { what: 'art', read: (store: Store) => store.getArt(1) },
    ])(
      'should drop the $what read in the old language when the language changes',
      ({ read }) => {
        const { sut, dir } = setup();
        sut.setSchema(1, []);
        sut.setGame(makeGameView({ appid: 1 }));
        sut.setArt(new Map([[1, { header: 'header', capsule: 'capsule' }]]));

        sut.setLanguage('pt-BR');

        const reopened = new Store(dir);
        expect(read(reopened)).toBeNull();
      },
    );

    it('should keep the counts when the language changes', () => {
      const { sut, dir } = setup();
      sut.setSummaries({ 1: SUMMARY });

      sut.setLanguage('pt-BR');

      const reopened = new Store(dir);
      expect(reopened.getSummary(1)).toEqual(SUMMARY);
    });

    it('should drop a cache read in another language when it opens', () => {
      const dir = makeTempDir();
      writeFileSync(
        join(dir, 'cache.json'),
        JSON.stringify({
          version: 2,
          language: 'pt-BR',
          accounts: {},
          art: {},
          schemas: { 1: { fetchedAt: 1, items: [] } },
        }),
      );

      const { sut } = setup({ dir });

      expect(sut.getSchema(1)).toBeNull();
    });

    it('should keep a cache read in its own language when it opens', () => {
      const dir = makeTempDir();
      new Store(dir).setSchema(2, [], 5);

      const { sut } = setup({ dir });

      expect(sut.getSchema(2)).toEqual({ fetchedAt: 5, items: [] });
    });
  });

  describe('list orders', () => {
    it('should answer the default order of the achievements when none was chosen', () => {
      const { sut } = setup();

      const sort = sut.getAchievementSort();

      expect(sort).toEqual({ pending: 'common', unlocked: 'recent' });
    });

    it('should answer the chosen order of the achievements when the folder is opened again', () => {
      const { sut, dir } = setup();

      sut.setAchievementSort({ pending: 'closest', unlocked: 'rare' });

      const reopened = new Store(dir);
      expect(reopened.getAchievementSort()).toEqual({
        pending: 'closest',
        unlocked: 'rare',
      });
    });

    it('should answer the default order of the achievements when the stored one is invalid', () => {
      const dir = makeTempDir();
      // `closest` only makes sense for pending achievements.
      writeFileSync(
        join(dir, 'settings.json'),
        JSON.stringify({
          achievementSort: { pending: 'recent', unlocked: 'closest' },
        }),
      );
      const { sut } = setup({ dir });

      const sort = sut.getAchievementSort();

      expect(sort).toEqual({ pending: 'common', unlocked: 'recent' });
    });

    it('should answer the default order of the dashboard when none was chosen', () => {
      const { sut } = setup();

      const sort = sut.getDashboardSort();

      expect(sort).toEqual({ ongoing: 'closest', complete: 'completed' });
    });

    it('should answer the chosen order of the dashboard when the folder is opened again', () => {
      const { sut, dir } = setup();

      sut.setDashboardSort({ ongoing: 'played', complete: 'name' });

      const reopened = new Store(dir);
      expect(reopened.getDashboardSort()).toEqual({
        ongoing: 'played',
        complete: 'name',
      });
    });
  });

  describe('update attempt', () => {
    it('should answer no version when the app never closed itself to install one', () => {
      const { sut } = setup();

      const version = sut.getUpdateAttempt();

      expect(version).toBeNull();
    });

    it('should answer the version the app closed itself to install when the folder is opened again', () => {
      const { sut, dir } = setup();

      sut.setUpdateAttempt('1.2.0');

      const reopened = new Store(dir);
      expect(reopened.getUpdateAttempt()).toBe('1.2.0');
    });

    it('should answer no version when the attempt was cleared', () => {
      const { sut, dir } = setup();
      sut.setUpdateAttempt('1.2.0');

      sut.setUpdateAttempt(null);

      const reopened = new Store(dir);
      expect(reopened.getUpdateAttempt()).toBeNull();
    });
  });

  describe('user data', () => {
    it('should answer a note and its pin when the folder is opened again', () => {
      const { sut, dir } = setupWithAccount();

      sut.setUserData(10, 'A', { note: 'boss of the 3rd map', pinned: true });

      const reopened = new Store(dir);
      expect(reopened.getUserData(10)).toEqual({
        A: { note: 'boss of the 3rd map', pinned: true },
      });
    });

    it('should remove an entry when it is left with a blank note and no pin', () => {
      const { sut, dir } = setupWithAccount();
      sut.setUserData(10, 'B', { note: '', pinned: true });

      sut.setUserData(10, 'B', { note: ' ', pinned: false });

      const reopened = new Store(dir);
      expect(reopened.getUserData(10)).toEqual({});
    });

    it('should keep an entry when it has only a checklist', () => {
      const { sut, dir } = setupWithAccount();

      sut.setUserData(10, 'A', {
        note: '',
        pinned: false,
        checklist: CHECKLIST,
      });

      const reopened = new Store(dir);
      expect(reopened.getUserData(10)).toEqual({
        A: { note: '', pinned: false, checklist: CHECKLIST },
      });
    });

    it('should remove an entry when its checklist is emptied', () => {
      const { sut, dir } = setupWithAccount();
      sut.setUserData(10, 'A', {
        note: '',
        pinned: false,
        checklist: CHECKLIST,
      });

      sut.setUserData(10, 'A', { note: '', pinned: false, checklist: [] });

      const reopened = new Store(dir);
      expect(reopened.getUserData(10)).toEqual({});
    });
  });

  describe('window settings', () => {
    it('should answer always-on-top as set when the folder is opened again', () => {
      const { sut, dir } = setup();

      sut.setAlwaysOnTop(true);

      const reopened = new Store(dir);
      expect(reopened.getAlwaysOnTop()).toBe(true);
    });

    it('should remember the window when no preference was set', () => {
      const { sut } = setup();

      const preferences = sut.getPreferences();

      expect(preferences).toEqual({ rememberWindow: true });
    });

    it('should answer a preference the user changed when the folder is opened again', () => {
      const { sut, dir } = setup();

      sut.setPreference('rememberWindow', false);

      const reopened = new Store(dir);
      expect(reopened.getPreferences()).toEqual({ rememberWindow: false });
    });

    it('should answer where the window was closed when the folder is opened again', () => {
      const { sut, dir } = setup();

      sut.setWindowBounds(BOUNDS);

      const reopened = new Store(dir);
      expect(reopened.getWindowBounds()).toEqual(BOUNDS);
    });

    it('should forget where the window was when asked not to remember it', () => {
      const { sut, dir } = setup();
      sut.setWindowBounds(BOUNDS);

      sut.setPreference('rememberWindow', false);

      const reopened = new Store(dir);
      expect(reopened.getWindowBounds()).toBeNull();
    });
  });

  describe('files that cannot be used', () => {
    it('should leave no half-written file behind when it writes', () => {
      const { sut, dir } = setupWithAccount();

      sut.setUserData(10, 'A', NOTE);

      expect(filesEnding(dir, '.tmp')).toEqual([]);
    });

    it('should keep a damaged file aside when the next write replaces it', () => {
      const dir = makeAccountDir();
      writeFileSync(join(dir, 'userdata.json'), '{"accounts": {"7656');
      const { sut } = setup({ dir });

      sut.setUserData(10, 'A', NOTE);

      const kept = readFileSync(join(dir, 'userdata.json.damaged.bak'), 'utf8');
      expect(kept).toBe('{"accounts": {"7656');
    });

    it('should report the damaged file when it sets it aside', () => {
      const dir = makeAccountDir();
      writeFileSync(join(dir, 'userdata.json'), '{"accounts": {"7656');
      const reported: string[] = [];

      setup({ dir, options: { report: (message) => reported.push(message) } });

      expect(reported).toEqual([
        'userdata.json could not be used (damaged); kept as userdata.json.damaged.bak',
      ]);
    });

    it('should keep aside a file written by a later version of the app when the next write replaces it', () => {
      const dir = makeAccountDir();
      const later = JSON.stringify({ version: 99, accounts: 'another shape' });
      writeFileSync(join(dir, 'userdata.json'), later);
      const { sut } = setup({ dir });

      sut.setUserData(10, 'A', NOTE);

      const kept = readFileSync(join(dir, 'userdata.json.v99.bak'), 'utf8');
      expect(kept).toBe(later);
    });

    it('should not guess at a file when it is from before the format had a version', () => {
      const dir = makeAccountDir();
      writeFileSync(
        join(dir, 'userdata.json'),
        JSON.stringify({ 10: { A: NOTE } }),
      );

      const { sut } = setup({ dir });

      expect(sut.getUserData(10)).toEqual({});
    });

    it('should keep aside a file when it is from before the format had a version', () => {
      const dir = makeAccountDir();
      const older = JSON.stringify({ 10: { A: NOTE } });
      writeFileSync(join(dir, 'userdata.json'), older);

      setup({ dir });

      const kept = readFileSync(join(dir, 'userdata.json.v1.bak'), 'utf8');
      expect(kept).toBe(older);
    });

    it('should not keep an older cache aside when it drops it', () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, 'cache.json'), JSON.stringify({ games: {} }));
      const { sut } = setup({ dir });

      sut.setSummaries({ 10: SUMMARY });

      expect(filesEnding(dir, '.bak')).toEqual([]);
    });

    it('should read the settings when they are from before the format had a version', () => {
      const dir = makeTempDir();
      writeFileSync(
        join(dir, 'settings.json'),
        JSON.stringify({ alwaysOnTop: true, language: 'fr' }),
      );

      const { sut } = setup({ dir });

      expect(sut.getLanguage()).toBe('fr');
    });

    it('should set nothing aside when the files are fine', () => {
      const dir = makeAccountDir();
      new Store(dir).setUserData(10, 'A', NOTE);
      const { sut } = setup({ dir });

      sut.setUserData(10, 'B', NOTE);

      expect(filesEnding(dir, '.bak')).toEqual([]);
    });

    it.each(['config.json', 'cache.json', 'userdata.json', 'settings.json'])(
      'should say which version of the format %s is in when it writes it',
      (file) => {
        const { sut, dir } = setup();

        sut.setCredentials(CREDENTIALS, PROFILE);
        sut.setSummaries({ 10: SUMMARY });
        sut.setUserData(10, 'A', NOTE);
        sut.setAlwaysOnTop(true);

        const { version } = JSON.parse(
          readFileSync(join(dir, file), 'utf8'),
        ) as { version?: number };
        expect(version).toBe(2);
      },
    );
  });

  describe('writing what was read from Steam after a delay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not write a read when the delay has not passed', () => {
      const { sut, dir } = setup({ options: { cacheDelay: CACHE_DELAY } });
      sut.setSummaries({ 1: SUMMARY });

      vi.advanceTimersByTime(CACHE_DELAY - 1);

      expect(existsSync(join(dir, 'cache.json'))).toBe(false);
    });

    it('should write a read when the delay has passed', () => {
      const { sut, dir } = setup({ options: { cacheDelay: CACHE_DELAY } });
      sut.setSummaries({ 1: SUMMARY });

      vi.advanceTimersByTime(CACHE_DELAY);

      const reopened = new Store(dir);
      expect(reopened.getSummary(1)).toEqual(SUMMARY);
    });

    it('should schedule one write when a burst of reads arrives', () => {
      const { sut } = setup({ options: { cacheDelay: CACHE_DELAY } });

      for (let appid = 1; appid <= 50; appid++) {
        sut.setSummaries({ [appid]: SUMMARY });
      }

      expect(vi.getTimerCount()).toBe(1);
    });

    it('should write the whole burst when the delay has passed', () => {
      const { sut, dir } = setup({ options: { cacheDelay: CACHE_DELAY } });
      for (let appid = 1; appid <= 50; appid++) {
        sut.setSummaries({ [appid]: SUMMARY });
      }

      vi.advanceTimersByTime(CACHE_DELAY);

      const reopened = new Store(dir);
      expect(reopened.getSummary(50)).toEqual(SUMMARY);
    });

    it('should answer with a read when it is not written yet', () => {
      const { sut } = setup({ options: { cacheDelay: CACHE_DELAY } });

      sut.setSummaries({ 1: SUMMARY });

      expect(sut.getSummary(1)).toEqual(SUMMARY);
    });

    it('should write what is waiting when asked to, as the app closes', () => {
      const { sut, dir } = setup({ options: { cacheDelay: CACHE_DELAY } });
      sut.setSummaries({ 1: SUMMARY });

      sut.flush();

      const reopened = new Store(dir);
      expect(reopened.getSummary(1)).toEqual(SUMMARY);
    });
  });
});
