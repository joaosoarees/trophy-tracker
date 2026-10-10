import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
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
const SUMMARY = { total: 4, unlocked: 1, playtime: 10, lastUnlockAt: 900 };
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

/** The notes of the game 10 a store keeps for an account, whichever is in use. */
function notesOf(store: Store, steamId: string) {
  const inUse = store.getActiveSteamId();
  store.setActiveAccount(steamId);
  const notes = store.getUserData(10);
  if (inUse) store.setActiveAccount(inUse);
  return notes;
}

/** A data folder a store has already saved an account in, and left. */
function makeAccountDir(): string {
  const dir = makeTempDir();
  new Store(dir).setCredentials(CREDENTIALS, PROFILE);
  return dir;
}

/** Marks a file the store wrote as written in another version of the format. */
function rewriteVersion(dir: string, name: string, version: number): string {
  const file = join(dir, name);
  const content = JSON.parse(readFileSync(file, 'utf8')) as object;
  const rewritten = JSON.stringify({ ...content, version });
  writeFileSync(file, rewritten);
  return rewritten;
}

/**
 * Makes the disk refuse a file from now on: a folder sits where the file is
 * first written, and nothing can be written over a folder, on any system and
 * whoever runs the tests. Answers what makes the disk take the file again.
 */
function refuseWrites(dir: string, name: string): () => void {
  const inTheWay = join(dir, `${name}.tmp`);
  mkdirSync(inTheWay);
  return () => rmdirSync(inTheWay);
}

/**
 * Whether the store said, by throwing, that it could not write. The error is
 * the system's own, worded by each one: only that it is thrown is promised.
 */
function hasRefused(write: () => unknown): boolean {
  try {
    write();
    return false;
  } catch {
    return true;
  }
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

    it('should answer no credentials when the saved key can no longer be decrypted', () => {
      const { sut, dir } = setup({ cipher: CIPHER });
      sut.setCredentials(CREDENTIALS, PROFILE);
      const brokenCipher: ICipher = {
        encrypt: CIPHER.encrypt,
        decrypt: () => {
          throw new Error('the keyring changed');
        },
      };

      const reopened = new Store(dir, brokenCipher);

      expect(reopened.getCredentials()).toBeNull();
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

    it('should file a note under the account it names when another is in use by the time it is written', () => {
      const { sut } = setupWithTwoAccounts();

      sut.setUserData(10, 'A', NOTE, STEAM_ID);

      expect({
        theirs: notesOf(sut, OTHER_STEAM_ID),
        mine: notesOf(sut, STEAM_ID),
      }).toEqual({ theirs: {}, mine: { A: NOTE } });
    });

    it('should keep the note of the account in use when a note that was emptied names another account', () => {
      const { sut } = setupWithTwoAccounts();
      sut.setUserData(10, 'A', NOTE);

      sut.setUserData(10, 'A', { note: '', pinned: false }, STEAM_ID);

      expect(sut.getUserData(10)).toEqual({ A: NOTE });
    });

    it('should keep nothing when a note names an account that was removed', () => {
      const { sut, dir } = setupWithTwoAccounts();
      sut.removeAccount(STEAM_ID);

      sut.setUserData(10, 'A', NOTE, STEAM_ID);

      expect({
        inUse: sut.getUserData(10),
        isRemovedOneOnDisk: readFileSync(
          join(dir, 'userdata.json'),
          'utf8',
        ).includes(STEAM_ID),
      }).toEqual({ inUse: {}, isRemovedOneOnDisk: false });
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

  describe('languageIn', () => {
    it('should answer the language chosen in the folder', () => {
      const dir = makeTempDir();
      new Store(dir).setLanguage('fr');

      const language = Store.languageIn(dir);

      expect(language).toBe('fr');
    });

    it('should answer the default language when the folder does not exist', () => {
      const dir = join(makeTempDir(), 'not-there');

      const language = Store.languageIn(dir);

      expect(language).toBe('en');
    });

    it('should answer the default language when the file names none the app has', () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, 'settings.json'), '{"language":"de"}');

      const language = Store.languageIn(dir);

      expect(language).toBe('en');
    });

    it('should answer the default language and leave the folder as it is when the file is damaged', () => {
      const dir = makeTempDir();
      writeFileSync(join(dir, 'settings.json'), '{"language":"fr');

      const language = Store.languageIn(dir);

      expect(language).toBe('en');
      expect(readdirSync(dir)).toEqual(['settings.json']);
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

    it('should keep where the window was when asked to remember it', () => {
      const { sut, dir } = setup();
      sut.setWindowBounds(BOUNDS);

      sut.setPreference('rememberWindow', true);

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

    it.each(['[1, 2]', '"text"', 'null', '7'])(
      'should keep the file aside as damaged when what it holds is %s, not an object',
      (content) => {
        const dir = makeAccountDir();
        writeFileSync(join(dir, 'userdata.json'), content);

        setup({ dir });

        const kept = readFileSync(
          join(dir, 'userdata.json.damaged.bak'),
          'utf8',
        );
        expect(kept).toBe(content);
      },
    );

    it('should start with no notes when the file that holds them is not an object', () => {
      const dir = makeAccountDir();
      writeFileSync(join(dir, 'userdata.json'), '[1, 2]');

      const { sut } = setup({ dir });

      expect(sut.getUserData(10)).toEqual({});
    });

    it.each(['config.json', 'cache.json', 'userdata.json', 'settings.json'])(
      'should keep %s aside when it is damaged',
      (name) => {
        const dir = makeTempDir();
        writeFileSync(join(dir, name), '{"cut short');

        setup({ dir });

        expect(filesEnding(dir, '.bak')).toEqual([`${name}.damaged.bak`]);
      },
    );

    it('should say so, and start from nothing, when the damaged file cannot be copied aside', () => {
      const dir = makeAccountDir();
      writeFileSync(join(dir, 'userdata.json'), '{"accounts": {"7656');
      // A folder where the copy would go: nothing can be copied over it.
      mkdirSync(join(dir, 'userdata.json.damaged.bak'));
      const reported: string[] = [];

      const { sut } = setup({
        dir,
        options: { report: (message) => reported.push(message) },
      });

      expect(reported).toEqual([
        'userdata.json could not be used (damaged) nor copied aside',
      ]);
      expect(sut.getUserData(10)).toEqual({});
    });

    it('should report the version of a file from another version when it sets it aside', () => {
      const dir = makeAccountDir();
      rewriteVersion(dir, 'config.json', 99);
      const reported: string[] = [];

      setup({ dir, options: { report: (message) => reported.push(message) } });

      expect(reported).toEqual([
        'config.json could not be used (v99); kept as config.json.v99.bak',
      ]);
    });

    it('should not know the accounts of a file written by a later version of the app', () => {
      const dir = makeAccountDir();
      rewriteVersion(dir, 'config.json', 99);

      const { sut } = setup({ dir });

      expect(sut.getAccounts()).toEqual([]);
    });

    it('should keep aside the accounts written by a later version of the app when it opens', () => {
      const dir = makeAccountDir();
      const later = rewriteVersion(dir, 'config.json', 99);

      setup({ dir });

      const kept = readFileSync(join(dir, 'config.json.v99.bak'), 'utf8');
      expect(kept).toBe(later);
    });

    // Windows has no permission bits; see the test of the key's own file.
    it.skipIf(process.platform === 'win32')(
      'should let only the user read the copy when a file is set aside, since it may hold a key',
      () => {
        const dir = makeAccountDir();
        writeFileSync(join(dir, 'userdata.json'), '{"accounts": {"7656');

        setup({ dir });

        const copy = join(dir, 'userdata.json.damaged.bak');
        expect(statSync(copy).mode & 0o777).toBe(0o600);
      },
    );

    it('should not read a cache written by a later version of the app', () => {
      const dir = makeAccountDir();
      new Store(dir).setSummaries({ 10: SUMMARY });
      rewriteVersion(dir, 'cache.json', 99);

      const { sut } = setup({ dir });

      expect(sut.getSummary(10)).toBeNull();
    });

    it('should not keep a later cache aside when it drops it', () => {
      const dir = makeAccountDir();
      new Store(dir).setSummaries({ 10: SUMMARY });
      rewriteVersion(dir, 'cache.json', 99);

      setup({ dir });

      expect(filesEnding(dir, '.bak')).toEqual([]);
    });

    it('should start from the default settings when they were written by a later version of the app', () => {
      const dir = makeTempDir();
      new Store(dir).setLanguage('fr');
      rewriteVersion(dir, 'settings.json', 99);

      const { sut } = setup({ dir });

      expect(sut.getLanguage()).toBe('en');
    });

    it('should keep aside the settings written by a later version of the app when it opens', () => {
      const dir = makeTempDir();
      new Store(dir).setLanguage('fr');
      const later = rewriteVersion(dir, 'settings.json', 99);

      setup({ dir });

      const kept = readFileSync(join(dir, 'settings.json.v99.bak'), 'utf8');
      expect(kept).toBe(later);
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

  describe('a write the disk refuses', () => {
    it.each<[string, (store: Store) => unknown, (store: Store) => unknown]>([
      [
        'always on top',
        (store) => store.setAlwaysOnTop(true),
        (store) => store.getAlwaysOnTop(),
      ],
      [
        'a preference',
        (store) => store.setPreference('rememberWindow', false),
        (store) => store.getPreferences(),
      ],
      [
        'the order of the achievements',
        (store) =>
          store.setAchievementSort({ pending: 'closest', unlocked: 'rare' }),
        (store) => store.getAchievementSort(),
      ],
      [
        'the order of the dashboard',
        (store) =>
          store.setDashboardSort({ ongoing: 'played', complete: 'name' }),
        (store) => store.getDashboardSort(),
      ],
      [
        'the version being installed',
        (store) => store.setUpdateAttempt('1.2.3'),
        (store) => store.getUpdateAttempt(),
      ],
      [
        'where the window was',
        (store) => store.setWindowBounds(BOUNDS),
        (store) => store.getWindowBounds(),
      ],
      [
        'the language',
        (store) => store.setLanguage('pt-BR'),
        (store) => store.getLanguage(),
      ],
    ])(
      'should say so and answer what it did before when %s cannot be written',
      (_what, write, read) => {
        const { sut, dir } = setup();
        const before = read(sut);
        refuseWrites(dir, 'settings.json');

        const hasThrown = hasRefused(() => write(sut));

        expect({ hasThrown, held: read(sut) }).toEqual({
          hasThrown: true,
          held: before,
        });
      },
    );

    it('should keep where the window was when it cannot write that it is no longer remembered', () => {
      const { sut, dir } = setup();
      sut.setWindowBounds(BOUNDS);
      refuseWrites(dir, 'settings.json');

      const hasThrown = hasRefused(() =>
        sut.setPreference('rememberWindow', false),
      );

      expect({ hasThrown, bounds: sut.getWindowBounds() }).toEqual({
        hasThrown: true,
        bounds: BOUNDS,
      });
    });

    it('should keep what was read in the language it stays in when the other one cannot be written', () => {
      const { sut, dir } = setup();
      sut.setSchema(1, [], 5);
      refuseWrites(dir, 'settings.json');

      const hasThrown = hasRefused(() => sut.setLanguage('pt-BR'));

      expect({ hasThrown, schema: sut.getSchema(1) }).toEqual({
        hasThrown: true,
        schema: { fetchedAt: 5, items: [] },
      });
    });

    it.each([
      { what: 'a new note', achievement: 'B', data: NOTE },
      {
        what: 'a note that changed',
        achievement: 'A',
        data: { note: 'changed', pinned: true },
      },
      {
        what: 'a note that was emptied',
        achievement: 'A',
        data: { note: '', pinned: false },
      },
    ])(
      'should say so and answer the notes that are saved when $what cannot be written',
      ({ achievement, data }) => {
        const { sut, dir } = setupWithAccount();
        sut.setUserData(10, 'A', NOTE);
        refuseWrites(dir, 'userdata.json');

        const hasThrown = hasRefused(() =>
          sut.setUserData(10, achievement, data),
        );

        expect({ hasThrown, notes: sut.getUserData(10) }).toEqual({
          hasThrown: true,
          notes: { A: NOTE },
        });
      },
    );

    it('should keep the notes of the account a refused note names when another is in use', () => {
      const { sut, dir } = setupWithTwoAccounts();
      sut.setUserData(10, 'A', NOTE, STEAM_ID);
      refuseWrites(dir, 'userdata.json');

      const hasThrown = hasRefused(() =>
        sut.setUserData(10, 'A', { note: 'changed', pinned: false }, STEAM_ID),
      );

      expect({ hasThrown, notes: notesOf(sut, STEAM_ID) }).toEqual({
        hasThrown: true,
        notes: { A: NOTE },
      });
    });

    it.each<{
      file: string;
      refused: (store: Store) => unknown;
      next: (store: Store) => unknown;
      read: (store: Store) => unknown;
      saved: unknown;
    }>([
      {
        file: 'settings.json',
        refused: (store) => store.setAlwaysOnTop(true),
        next: (store) => store.setWindowBounds(BOUNDS),
        read: (store) => store.getAlwaysOnTop(),
        saved: false,
      },
      {
        file: 'config.json',
        refused: (store) => store.setActiveAccount(STEAM_ID),
        next: (store) => store.setAccountStatus(STEAM_ID, 'rejected'),
        read: (store) => store.getActiveSteamId(),
        saved: OTHER_STEAM_ID,
      },
      {
        file: 'userdata.json',
        refused: (store) => store.setUserData(10, 'A', NOTE),
        next: (store) => store.setUserData(10, 'B', NOTE),
        read: (store) => store.getUserData(10),
        saved: { B: NOTE },
      },
    ])(
      'should not write to $file, with the next change, the one that was refused',
      ({ file, refused, next, read, saved }) => {
        const { sut, dir } = setupWithTwoAccounts();
        const takeWrites = refuseWrites(dir, file);
        hasRefused(() => refused(sut));
        takeWrites();

        next(sut);

        const reopened = new Store(dir);
        expect(read(reopened)).toEqual(saved);
      },
    );

    /**
     * Two accounts, `OTHER_STEAM_ID` in use, each with a note and a summary,
     * over a disk that takes the accounts but refuses the notes.
     */
    function setupRefusingNotes() {
      const { sut, dir } = setupWithTwoAccounts();
      sut.setUserData(10, 'A', NOTE);
      sut.setSummaries({ 10: SUMMARY });
      refuseWrites(dir, 'userdata.json');
      return { sut, dir };
    }

    /** What a store keeps of the account in use. */
    const inUseOf = (store: Store) => ({
      inUse: store.getActiveSteamId(),
      credentials: store.getCredentials(),
      accounts: store.getAccounts().map((account) => account.steamId),
      notes: store.getUserData(10),
      summary: store.getSummary(10),
    });

    const BEFORE_THE_REMOVAL = {
      inUse: OTHER_STEAM_ID,
      credentials: OTHER_CREDENTIALS,
      accounts: [STEAM_ID, OTHER_STEAM_ID],
      notes: { A: NOTE },
      summary: SUMMARY,
    };

    it('should say so and keep the account with everything of it when its notes cannot be removed', () => {
      const { sut } = setupRefusingNotes();

      const hasThrown = hasRefused(() => sut.removeAccount(OTHER_STEAM_ID));

      expect({ hasThrown, held: inUseOf(sut) }).toEqual({
        hasThrown: true,
        held: BEFORE_THE_REMOVAL,
      });
    });

    it('should still have the account when the folder is opened again after its notes could not be removed', () => {
      const { sut, dir } = setupRefusingNotes();
      hasRefused(() => sut.removeAccount(OTHER_STEAM_ID));

      const reopened = new Store(dir);

      expect(inUseOf(reopened)).toEqual(BEFORE_THE_REMOVAL);
    });

    it('should keep a read it could not write, and write it with the next one', () => {
      const { sut, dir } = setup({ options: { cacheDelay: CACHE_DELAY } });
      const takeWrites = refuseWrites(dir, 'cache.json');
      sut.setSummaries({ 1: SUMMARY });
      const hasThrown = hasRefused(() => sut.flush());
      takeWrites();

      sut.setSummaries({ 2: SUMMARY });
      sut.flush();

      const reopened = new Store(dir);
      expect({
        hasThrown,
        held: sut.getSummary(1),
        saved: [reopened.getSummary(1), reopened.getSummary(2)],
      }).toEqual({ hasThrown: true, held: SUMMARY, saved: [SUMMARY, SUMMARY] });
    });
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

    it('should write nothing when asked to, as the app closes, with nothing waiting', () => {
      const { sut, dir } = setup({ options: { cacheDelay: CACHE_DELAY } });
      sut.setSummaries({ 1: SUMMARY });
      sut.flush();
      const file = join(dir, 'cache.json');
      writeFileSync(file, 'written since');

      sut.flush();

      expect(readFileSync(file, 'utf8')).toBe('written since');
    });

    it('should not write again when the delay passes after what was waiting was written as the app closes', () => {
      const { sut, dir } = setup({ options: { cacheDelay: CACHE_DELAY } });
      sut.setSummaries({ 1: SUMMARY });
      sut.flush();
      const file = join(dir, 'cache.json');
      writeFileSync(file, 'written since');

      vi.advanceTimersByTime(CACHE_DELAY);

      expect(readFileSync(file, 'utf8')).toBe('written since');
    });

    it('should write a read after its delay when it arrives after what was waiting was written', () => {
      const { sut, dir } = setup({ options: { cacheDelay: CACHE_DELAY } });
      sut.setSummaries({ 1: SUMMARY });
      sut.flush();
      sut.setSummaries({ 2: SUMMARY });

      vi.advanceTimersByTime(CACHE_DELAY);

      const reopened = new Store(dir);
      expect(reopened.getSummary(2)).toEqual(SUMMARY);
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
