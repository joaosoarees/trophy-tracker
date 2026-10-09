import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { Store } from '@main/storage/Store';
import { KEY, OTHER_KEY, OTHER_STEAM_ID, STEAM_ID } from '@test/helpers';

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'stt-'));
const profile = { steamId: STEAM_ID, name: 'player', avatar: '' };

describe('Store', () => {
  it('stores the key in a user-only file and reads it back', () => {
    const dir = tempDir();
    new Store(dir).setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile);
    // Windows has no permission bits; there the user's profile folder is
    // what keeps other accounts out.
    if (process.platform !== 'win32') {
      expect(statSync(join(dir, 'config.json')).mode & 0o777).toBe(0o600);
    }
    const again = new Store(dir);
    expect(again.getCredentials()).toEqual({ steamId: STEAM_ID, apiKey: KEY });
    expect(again.getProfile()).toEqual(profile);
  });

  it('remembers the version the app closed itself to install', () => {
    const dir = tempDir();
    const store = new Store(dir);
    expect(store.getUpdateAttempt()).toBeNull();
    store.setUpdateAttempt('1.2.0');
    expect(new Store(dir).getUpdateAttempt()).toBe('1.2.0');
    store.setUpdateAttempt(null);
    expect(new Store(dir).getUpdateAttempt()).toBeNull();
  });

  it('encrypts the key when a cipher is available', () => {
    const dir = tempDir();
    const cipher = {
      encrypt: (s: string) => `enc:${s}`,
      decrypt: (s: string) => s.slice(4),
    };
    new Store(dir, cipher).setCredentials(
      { steamId: STEAM_ID, apiKey: KEY },
      profile,
    );
    expect(new Store(dir).getCredentials()).toBeNull();
    expect(new Store(dir, cipher).getCredentials()?.apiKey).toBe(KEY);
  });

  it('starts in English', () => {
    expect(new Store(tempDir()).getLanguage()).toBe('en');
  });

  it('remembers the language', () => {
    const dir = tempDir();

    new Store(dir).setLanguage('pt-BR');

    expect(new Store(dir).getLanguage()).toBe('pt-BR');
  });

  it('drops what was read in the old language when the language changes, keeping the counts', () => {
    const dir = tempDir();
    const store = new Store(dir);
    store.setSchema(1, []);
    store.setSummaries({ 1: { total: 4, unlocked: 1, playtime: 10 } });

    store.setLanguage('pt-BR');

    const again = new Store(dir);
    expect(again.getSchema(1)).toBeNull();
    expect(again.getSummary(1)).toEqual({
      total: 4,
      unlocked: 1,
      playtime: 10,
    });
  });

  it('drops a cache written in another language on startup (e.g. from an earlier, Portuguese-only version)', () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, 'cache.json'),
      JSON.stringify({
        games: {},
        summaries: {},
        art: {},
        schemas: { 1: { fetchedAt: 1, items: [] } },
      }),
    );
    expect(new Store(dir).getSchema(1)).toBeNull();

    const store = new Store(dir);
    store.setSchema(2, []);
    expect(new Store(dir).getSchema(2)).toEqual({
      fetchedAt: expect.any(Number),
      items: [],
    });
  });

  it('remembers the order chosen for each list and ignores invalid stored values', () => {
    const dir = tempDir();
    const store = new Store(dir);
    expect(store.getAchievementSort()).toEqual({
      pending: 'common',
      unlocked: 'recent',
    });

    store.setAchievementSort({ pending: 'closest', unlocked: 'rare' });
    expect(new Store(dir).getAchievementSort()).toEqual({
      pending: 'closest',
      unlocked: 'rare',
    });

    // `closest` only makes sense for pending achievements.
    writeFileSync(
      join(dir, 'settings.json'),
      JSON.stringify({
        achievementSort: { pending: 'recent', unlocked: 'closest' },
      }),
    );
    expect(new Store(dir).getAchievementSort()).toEqual({
      pending: 'common',
      unlocked: 'recent',
    });
  });

  it('remembers the order chosen for each dashboard list', () => {
    const dir = tempDir();
    const store = new Store(dir);
    expect(store.getDashboardSort()).toEqual({
      ongoing: 'closest',
      complete: 'completed',
    });

    store.setDashboardSort({ ongoing: 'played', complete: 'name' });
    expect(new Store(dir).getDashboardSort()).toEqual({
      ongoing: 'played',
      complete: 'name',
    });
  });

  it('persists notes and pins', () => {
    const dir = tempDir();

    new Store(dir).setUserData(10, 'A', {
      note: 'boss of the 3rd map',
      pinned: true,
    });

    expect(new Store(dir).getUserData(10)).toEqual({
      A: { note: 'boss of the 3rd map', pinned: true },
    });
  });

  it('removes an entry left with a blank note and no pin', () => {
    const dir = tempDir();
    const store = new Store(dir);
    store.setUserData(10, 'B', { note: '', pinned: true });

    store.setUserData(10, 'B', { note: ' ', pinned: false });

    expect(new Store(dir).getUserData(10)).toEqual({});
  });

  it('keeps an entry that has only a checklist', () => {
    const dir = tempDir();
    const checklist = [{ id: '1', text: 'Bridge Kodama', done: true }];

    new Store(dir).setUserData(10, 'A', { note: '', pinned: false, checklist });

    expect(new Store(dir).getUserData(10)).toEqual({
      A: { note: '', pinned: false, checklist },
    });
  });

  it('removes the entry when its checklist is emptied', () => {
    const dir = tempDir();
    const store = new Store(dir);
    const checklist = [{ id: '1', text: 'Bridge Kodama', done: true }];
    store.setUserData(10, 'A', { note: '', pinned: false, checklist });

    store.setUserData(10, 'A', { note: '', pinned: false, checklist: [] });

    expect(new Store(dir).getUserData(10)).toEqual({});
  });

  it('remembers always-on-top', () => {
    const dir = tempDir();

    new Store(dir).setAlwaysOnTop(true);

    expect(new Store(dir).getAlwaysOnTop()).toBe(true);
  });

  it('remembers the window unless told otherwise', () => {
    expect(new Store(tempDir()).getPreferences()).toEqual({
      rememberWindow: true,
    });
  });

  it('remembers a preference the user changed', () => {
    const dir = tempDir();

    new Store(dir).setPreference('rememberWindow', false);

    expect(new Store(dir).getPreferences().rememberWindow).toBe(false);
  });

  it('remembers where the window was closed', () => {
    const dir = tempDir();
    const bounds = { x: 2000, y: 100, width: 640, height: 900 };

    new Store(dir).setWindowBounds(bounds);

    expect(new Store(dir).getWindowBounds()).toEqual(bounds);
  });

  it('forgets where the window was when asked not to remember it', () => {
    const dir = tempDir();
    const store = new Store(dir);
    store.setWindowBounds({ x: 2000, y: 100, width: 640, height: 900 });

    store.setPreference('rememberWindow', false);

    expect(new Store(dir).getWindowBounds()).toBeNull();
  });
});

describe('Store: several accounts', () => {
  const other = { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' };
  const note = { note: 'mine', pinned: false };

  /** Two accounts; the second one added is the one in use. */
  function withTwoAccounts(dir = tempDir()) {
    const store = new Store(dir);
    store.setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile, 1000);
    store.setCredentials(
      { steamId: OTHER_STEAM_ID, apiKey: OTHER_KEY },
      other,
      2000,
    );
    return { store, dir };
  }

  it('lists the accounts without their keys', () => {
    const { store } = withTwoAccounts();

    expect(store.getAccounts()).toEqual([
      {
        ...profile,
        keyEnding: KEY.slice(-4),
        status: 'valid',
        checkedAt: 1000,
      },
      {
        ...other,
        keyEnding: OTHER_KEY.slice(-4),
        status: 'valid',
        checkedAt: 2000,
      },
    ]);
  });

  it('remembers which account is in use', () => {
    const { store, dir } = withTwoAccounts();

    store.setActiveAccount(STEAM_ID);

    expect(new Store(dir).getCredentials()).toEqual({
      steamId: STEAM_ID,
      apiKey: KEY,
    });
  });

  it('does not follow an account it has no key for', () => {
    const { store } = withTwoAccounts();

    expect(store.setActiveAccount('76561198000000099')).toBe(false);
    expect(store.getActiveSteamId()).toBe(OTHER_STEAM_ID);
  });

  it('keeps what was read from Steam apart for each account', () => {
    const { store } = withTwoAccounts();
    store.setSummaries({ 10: { total: 4, unlocked: 1, playtime: 10 } });

    store.setActiveAccount(STEAM_ID);

    expect(store.getSummary(10)).toBeNull();
    store.setActiveAccount(OTHER_STEAM_ID);
    expect(store.getSummary(10)?.unlocked).toBe(1);
  });

  it('hands a late read to the account it was made for', () => {
    const { store } = withTwoAccounts();

    store.setSummaries(
      { 10: { total: 4, unlocked: 3, playtime: 10 } },
      STEAM_ID,
    );

    expect(store.getSummary(10)).toBeNull();
    store.setActiveAccount(STEAM_ID);
    expect(store.getSummary(10)?.unlocked).toBe(3);
  });

  it('drops a late read for an account that was removed', () => {
    const { store, dir } = withTwoAccounts();
    store.removeAccount(STEAM_ID);

    store.setSummaries(
      { 10: { total: 4, unlocked: 3, playtime: 10 } },
      STEAM_ID,
    );

    expect(readFileSync(join(dir, 'cache.json'), 'utf8')).not.toContain(
      STEAM_ID,
    );
  });

  it('keeps notes apart for each account', () => {
    const { store } = withTwoAccounts();
    store.setUserData(10, 'A', note);

    store.setActiveAccount(STEAM_ID);

    expect(store.getUserData(10)).toEqual({});
    store.setActiveAccount(OTHER_STEAM_ID);
    expect(store.getUserData(10)).toEqual({ A: note });
  });

  it('removing an account deletes its key, what was read and its notes', () => {
    const { store, dir } = withTwoAccounts();
    store.setUserData(10, 'A', note);
    store.setSummaries({ 10: { total: 4, unlocked: 1, playtime: 10 } });

    store.removeAccount(OTHER_STEAM_ID);

    for (const file of ['config.json', 'cache.json', 'userdata.json']) {
      expect(readFileSync(join(dir, file), 'utf8')).not.toContain(
        OTHER_STEAM_ID,
      );
    }
    expect(store.getActiveSteamId()).toBe(STEAM_ID);
  });

  it('gives a new key to an account that is already there, keeping the rest', () => {
    const { store } = withTwoAccounts();
    store.setUserData(10, 'A', note);

    store.setCredentials({ steamId: OTHER_STEAM_ID, apiKey: KEY }, other);

    expect(store.getAccounts()).toHaveLength(2);
    expect(store.getCredentials()?.apiKey).toBe(KEY);
    expect(store.getUserData(10)).toEqual({ A: note });
  });

  it('records what Steam last said about a key', () => {
    const { store, dir } = withTwoAccounts();

    store.setAccountStatus(STEAM_ID, 'rejected', 3000);

    expect(new Store(dir).getAccounts()[0]).toMatchObject({
      status: 'rejected',
      checkedAt: 3000,
    });
  });
});

describe('Store: files of the versions with a single account', () => {
  const note = { note: 'mine', pinned: false };

  function legacy() {
    const dir = tempDir();
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ steamId: STEAM_ID, apiKey: KEY, profile }),
    );
    writeFileSync(
      join(dir, 'cache.json'),
      JSON.stringify({
        language: 'en',
        games: {},
        summaries: { 10: { total: 4, unlocked: 1, playtime: 10 } },
        art: {},
        schemas: {},
      }),
    );
    writeFileSync(
      join(dir, 'userdata.json'),
      JSON.stringify({ 10: { A: note } }),
    );
    return dir;
  }

  it('turns the saved key into the first account, still in use', () => {
    const store = new Store(legacy());

    expect(store.getCredentials()).toEqual({ steamId: STEAM_ID, apiKey: KEY });
    expect(store.getAccounts()).toEqual([
      {
        ...profile,
        keyEnding: KEY.slice(-4),
        status: 'unchecked',
        checkedAt: null,
      },
    ]);
  });

  it('keeps what had been read from Steam', () => {
    expect(new Store(legacy()).getSummary(10)?.unlocked).toBe(1);
  });

  it("keeps the notes, as that account's", () => {
    const store = new Store(legacy());

    expect(store.getUserData(10)).toEqual({ A: note });
    store.setCredentials(
      { steamId: OTHER_STEAM_ID, apiKey: OTHER_KEY },
      { steamId: OTHER_STEAM_ID, name: 'other', avatar: '' },
    );
    expect(store.getUserData(10)).toEqual({});
  });

  it('reads the same after the files were rewritten in the new shape', () => {
    const dir = legacy();
    new Store(dir).setUserData(10, 'B', note);

    const again = new Store(dir);

    expect(again.getCredentials()?.apiKey).toBe(KEY);
    expect(again.getUserData(10)).toEqual({ A: note, B: note });
  });

  it('gives notes written with no account to the first account added', () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, 'userdata.json'),
      JSON.stringify({ 10: { A: note } }),
    );
    const store = new Store(dir);

    store.setCredentials({ steamId: STEAM_ID, apiKey: KEY }, profile);

    expect(store.getUserData(10)).toEqual({ A: note });
  });
});

describe('Store: files that cannot be used', () => {
  const note = { note: 'mine', pinned: false };
  const summary = { 10: { total: 4, unlocked: 1, playtime: 10 } };

  it('leaves no half-written file behind', () => {
    const dir = tempDir();

    new Store(dir).setUserData(10, 'A', note);

    expect(readdirSync(dir).filter((file) => file.endsWith('.tmp'))).toEqual(
      [],
    );
    expect(new Store(dir).getUserData(10)).toEqual({ A: note });
  });

  it('keeps a damaged file aside instead of treating it as empty', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'userdata.json'), '{"accounts": {"7656');
    const reported: string[] = [];

    const store = new Store(dir, null, {
      report: (message) => reported.push(message),
    });
    store.setUserData(10, 'A', note);

    expect(readFileSync(join(dir, 'userdata.json.damaged.bak'), 'utf8')).toBe(
      '{"accounts": {"7656',
    );
    expect(reported).toEqual([
      'userdata.json could not be used (damaged); kept as userdata.json.damaged.bak',
    ]);
  });

  it('keeps aside a file written by a later version of the app', () => {
    const dir = tempDir();
    const later = JSON.stringify({ version: 99, accounts: 'another shape' });
    writeFileSync(join(dir, 'userdata.json'), later);

    new Store(dir).setUserData(10, 'A', note);

    expect(readFileSync(join(dir, 'userdata.json.v99.bak'), 'utf8')).toBe(
      later,
    );
  });

  it('sets nothing aside when the files are fine', () => {
    const dir = tempDir();
    new Store(dir).setUserData(10, 'A', note);

    new Store(dir).setUserData(10, 'B', note);

    expect(readdirSync(dir).filter((file) => file.endsWith('.bak'))).toEqual(
      [],
    );
  });

  it('says which version of the format each file is in', () => {
    const dir = tempDir();

    new Store(dir).setSummaries(summary);

    expect(
      (
        JSON.parse(readFileSync(join(dir, 'cache.json'), 'utf8')) as {
          version: number;
        }
      ).version,
    ).toBe(2);
  });
});

describe('Store: writing what was read from Steam', () => {
  const entry = { total: 4, unlocked: 1, playtime: 10 };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes a burst of reads once, after a moment', () => {
    vi.useFakeTimers();
    const dir = tempDir();
    const store = new Store(dir, null, { cacheDelay: 1000 });

    for (let appid = 1; appid <= 50; appid++) {
      store.setSummaries({ [appid]: entry });
    }

    expect(existsSync(join(dir, 'cache.json'))).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(new Store(dir).getSummary(50)).toEqual(entry);
  });

  it('answers with what was read before it is written', () => {
    vi.useFakeTimers();
    const store = new Store(tempDir(), null, { cacheDelay: 1000 });

    store.setSummaries({ 1: entry });

    expect(store.getSummary(1)).toEqual(entry);
  });

  it('writes what is waiting when asked to, as the app closes', () => {
    vi.useFakeTimers();
    const dir = tempDir();
    const store = new Store(dir, null, { cacheDelay: 1000 });
    store.setSummaries({ 1: entry });

    store.flush();

    expect(new Store(dir).getSummary(1)).toEqual(entry);
  });
});
