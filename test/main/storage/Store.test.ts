import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { Store } from '@main/storage/Store';
import { KEY, STEAM_ID } from '@test/helpers';

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'stt-'));
const profile = { steamId: STEAM_ID, name: 'joao', avatar: '' };

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

  it('starts in English, remembers the language and drops the translated cache on change', () => {
    const dir = tempDir();
    const store = new Store(dir);
    expect(store.getLanguage()).toBe('en');
    store.setSchema(1, []);
    store.setSummaries({ 1: { total: 4, unlocked: 1, playtime: 10 } });
    store.setLanguage('pt-BR');
    const again = new Store(dir);
    expect(again.getLanguage()).toBe('pt-BR');
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

  it('persists notes and pins, and removes empty entries', () => {
    const dir = tempDir();
    const store = new Store(dir);
    store.setUserData(10, 'A', { note: 'boss of the 3rd map', pinned: true });
    store.setUserData(10, 'B', { note: '', pinned: true });
    store.setUserData(10, 'B', { note: ' ', pinned: false });
    expect(new Store(dir).getUserData(10)).toEqual({
      A: { note: 'boss of the 3rd map', pinned: true },
    });
  });

  it('keeps the entry while there is a checklist and remembers always-on-top', () => {
    const dir = tempDir();
    const store = new Store(dir);
    const checklist = [{ id: '1', text: 'Bridge Kodama', done: true }];
    store.setUserData(10, 'A', { note: '', pinned: false, checklist });
    store.setAlwaysOnTop(true);
    const again = new Store(dir);
    expect(again.getUserData(10)).toEqual({
      A: { note: '', pinned: false, checklist },
    });
    expect(again.getAlwaysOnTop()).toBe(true);
    again.setUserData(10, 'A', { note: '', pinned: false, checklist: [] });
    expect(new Store(dir).getUserData(10)).toEqual({});
  });
});
