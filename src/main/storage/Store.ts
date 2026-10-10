import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import {
  type IAchievementSort,
  parseAchievementSort,
} from '@shared/achievementSort';
import { type IDashboardSort, parseDashboardSort } from '@shared/dashboardSort';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from '@shared/i18n';
import { type AccountStatus, type IAccount } from '@shared/types/Account';
import { type IGameView } from '@shared/types/Game';
import {
  DEFAULT_PREFERENCES,
  type IPreferences,
} from '@shared/types/Preferences';
import { type IProfile } from '@shared/types/Profile';
import {
  type GameUserData,
  type IAchievementUserData,
} from '@shared/types/UserData';

import type {
  ICredentials,
  IRawOwnedGame,
  IRawSchemaAchievement,
  IStoreArt,
} from '../steam/SteamClient';
import { type IBounds, WindowBounds } from '../system/WindowBounds';

/** Optional cipher for the key (Electron's safeStorage, when there is a keyring). */
export interface ICipher {
  encrypt: (plain: string) => string;
  decrypt: (encoded: string) => string;
}

/** One account as it is kept: the key, plain or encrypted, never leaves this file. */
interface IStoredAccount {
  steamId: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
  /** The last four characters of the key: what the interface shows of it. */
  keyEnding: string;
  profile: IProfile;
  status: AccountStatus;
}

interface IConfigFile {
  accounts: IStoredAccount[];
  /** The account being followed. */
  activeSteamId?: string;
}

export interface ISummaryEntry {
  total: number;
  unlocked: number;
  /** Playtime at the time of the read; if it has not changed, neither have the achievements. */
  playtime: number;
  /** When the last achievement was unlocked (epoch in seconds, 0 if none). */
  lastUnlockAt: number;
}

/** What was read from Steam about one account. */
interface IAccountCache {
  library?: { fetchedAt: number; games: IRawOwnedGame[] };
  games: Record<string, IGameView>;
  summaries: Record<string, ISummaryEntry>;
}

interface ICacheFile {
  /** Language the Steam content was read in. */
  language?: string;
  /** By SteamID. */
  accounts: Record<string, IAccountCache>;
  // The same for every account: they describe the game, not the player.
  art: Record<string, IStoreArt>;
  schemas: Record<
    string,
    { fetchedAt: number; items: IRawSchemaAchievement[] }
  >;
}

interface ISettingsFile {
  alwaysOnTop: boolean;
  language?: string;
  achievementSort?: unknown;
  dashboardSort?: unknown;
  /** Version the app last closed itself to install. */
  updateAttempt?: string;
  rememberWindow?: boolean;
  /** Size and position the window was closed with. */
  windowBounds?: unknown;
}

/** Notes, pins and checklists of one account, by appid. */
type AccountUserData = Record<string, GameUserData>;

interface IUserDataFile {
  /** By SteamID. */
  accounts: Record<string, AccountUserData>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The shape of the files this version writes. A file in any other shape is
 * not read: there is no code here to convert an older one (see "Migrations"
 * in docs/local-data.md for when that would be worth writing). Version 1 is
 * what the versions before 0.7.0 wrote, which carried no number.
 */
const FILE_VERSION = 2;

export interface IStoreOptions {
  /**
   * How long to wait, in milliseconds, before writing what was read from
   * Steam. Reading a library changes the cache once per game; waiting turns
   * hundreds of writes of the whole file into one. Zero writes at once.
   */
  cacheDelay?: number;
  /** Told when a file could not be used and was set aside. */
  report?: (message: string) => void;
}

/**
 * The four files of the data folder, each held in memory as it was last
 * written. **Nothing is kept that could not be written:** a change to the
 * accounts, the settings or the notes is written first and taken only then,
 * so a write the disk refuses throws to whoever asked and leaves the store
 * answering exactly what it answered before, which is also what the file
 * holds. Never change `config`, `settings` or `userData` in place: build the
 * next content and hand it to `saveConfig`, `saveSettings` or `saveUserData`.
 *
 * What was read from Steam is the exception (`saveCache`): it is taken at
 * once and written later, so nobody can be told of a write that fails. Steam
 * gives all of it back, and a file left behind in another language is dropped
 * as the app opens.
 */
export class Store {
  private cacheDelay: number;
  private report: (message: string) => void;
  private cacheTimer: ReturnType<typeof setTimeout> | null = null;
  private config: IConfigFile;
  private cache: ICacheFile;
  private userData: IUserDataFile;
  private settings: ISettingsFile;

  constructor(
    private dir: string,
    private cipher: ICipher | null = null,
    { cacheDelay = 0, report = () => {} }: IStoreOptions = {},
  ) {
    this.cacheDelay = cacheDelay;
    this.report = report;
    mkdirSync(dir, { recursive: true });
    this.config = this.readConfig();
    this.cache = this.readCache();
    this.userData = this.readUserData();
    this.settings = this.read('settings.json', { alwaysOnTop: false });
    if (this.cache.language !== this.getLanguage()) this.dropTranslatedCache();
  }

  /**
   * Reads a file, or answers the fallback when there is none. A file that
   * cannot be used is never just treated as empty, because the next write
   * would then erase it for good: it is copied aside first. That covers a
   * file cut short by a crash and one in another version of the format.
   */
  private read<T>(name: string, fallback: T): T {
    const file = join(this.dir, name);
    if (!existsSync(file)) return fallback;

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      this.setAside(name, 'damaged');
      return fallback;
    }
    if (!isRecord(parsed)) {
      this.setAside(name, 'damaged');
      return fallback;
    }

    const { version, ...content } = parsed;
    const found = typeof version === 'number' ? version : 1;
    // Settings never changed shape, so theirs are read whatever they say.
    if (
      found === FILE_VERSION ||
      (name === 'settings.json' && found < FILE_VERSION)
    ) {
      return { ...fallback, ...(content as Partial<T>) };
    }
    // Another shape is not guessed at. What only Steam can give back is
    // dropped; what the user wrote or typed is kept aside.
    if (name !== 'cache.json') this.setAside(name, `v${found}`);
    return fallback;
  }

  private setAside(name: string, reason: string): void {
    const copy = `${name}.${reason}.bak`;
    try {
      copyFileSync(join(this.dir, name), join(this.dir, copy));
      // The copy may hold a key: as private as the file it came from.
      chmodSync(join(this.dir, copy), 0o600);
      this.report(`${name} could not be used (${reason}); kept as ${copy}`);
    } catch {
      this.report(`${name} could not be used (${reason}) nor copied aside`);
    }
  }

  /**
   * Writes a whole file under a temporary name and then puts it in place, so
   * a crash in the middle leaves the previous file, not half of the new one.
   */
  private write(name: string, data: object, mode?: number): void {
    const file = join(this.dir, name);
    const temporary = `${file}.tmp`;
    const content = { version: FILE_VERSION, ...data };
    writeFileSync(
      temporary,
      // The cache is large and only the app reads it; the rest stays readable.
      name === 'cache.json'
        ? JSON.stringify(content)
        : JSON.stringify(content, null, 2),
      { mode },
    );
    if (mode !== undefined) chmodSync(temporary, mode);
    renameSync(temporary, file);
  }

  private readConfig(): IConfigFile {
    return this.read<IConfigFile>('config.json', { accounts: [] });
  }

  private readCache(): ICacheFile {
    return this.read<ICacheFile>('cache.json', {
      accounts: {},
      art: {},
      schemas: {},
    });
  }

  private readUserData(): IUserDataFile {
    return this.read<IUserDataFile>('userdata.json', { accounts: {} });
  }

  private keyOf({
    apiKey,
    apiKeyEncrypted,
  }: Pick<IStoredAccount, 'apiKey' | 'apiKeyEncrypted'>): string | null {
    try {
      const key =
        apiKeyEncrypted && this.cipher
          ? this.cipher.decrypt(apiKeyEncrypted)
          : apiKey;
      return key ?? null;
    } catch {
      return null;
    }
  }

  private get active(): IStoredAccount | null {
    const { accounts, activeSteamId } = this.config;
    return accounts.find((a) => a.steamId === activeSteamId) ?? null;
  }

  /** Takes the accounts as given once the file holds them; throws, taking nothing, otherwise. */
  private saveConfig(next: IConfigFile): void {
    this.write('config.json', next, 0o600);
    this.config = next;
  }

  /** The same for the settings. */
  private saveSettings(next: ISettingsFile): void {
    this.write('settings.json', next);
    this.settings = next;
  }

  /** Credentials of the account in use. */
  getCredentials(): ICredentials | null {
    const account = this.active;
    if (!account) return null;
    const key = this.keyOf(account);
    return key ? { steamId: account.steamId, apiKey: key } : null;
  }

  /** Credentials of a saved account; `null` when it is unknown or its key cannot be read. */
  getCredentialsOf(steamId: string): ICredentials | null {
    const account = this.config.accounts.find((a) => a.steamId === steamId);
    const key = account ? this.keyOf(account) : null;
    return key ? { steamId, apiKey: key } : null;
  }

  /** Profile of the account in use. */
  getProfile(): IProfile | null {
    return this.active?.profile ?? null;
  }

  getActiveSteamId(): string | null {
    return this.active?.steamId ?? null;
  }

  /** Every account, as the interface may see it: without the key. */
  getAccounts(): IAccount[] {
    return this.config.accounts.map(
      ({ profile, keyEnding, status, apiKeyEncrypted }) => ({
        ...profile,
        keyEnding,
        isKeyEncrypted: apiKeyEncrypted !== undefined,
        status,
      }),
    );
  }

  hasAccount(steamId: string): boolean {
    return this.config.accounts.some((a) => a.steamId === steamId);
  }

  /**
   * Saves an account whose key Steam has just accepted and starts following
   * it, unless told not to: a key that is only replaced leaves the app on the
   * account in use, in the same write. An account that was already there gets
   * the new key and keeps its place.
   */
  setCredentials(
    { steamId, apiKey }: ICredentials,
    profile: IProfile,
    { shouldFollow = true } = {},
  ): void {
    const account: IStoredAccount = {
      steamId,
      ...(this.cipher
        ? { apiKeyEncrypted: this.cipher.encrypt(apiKey) }
        : { apiKey }),
      keyEnding: apiKey.slice(-4),
      profile,
      status: 'valid',
    };
    const { accounts, activeSteamId } = this.config;
    this.saveConfig({
      ...this.config,
      accounts: this.hasAccount(steamId)
        ? accounts.map((a) => (a.steamId === steamId ? account : a))
        : [...accounts, account],
      activeSteamId: shouldFollow ? steamId : activeSteamId,
    });
  }

  /** Starts following another saved account; answers whether there is one. */
  setActiveAccount(steamId: string): boolean {
    if (!this.hasAccount(steamId)) return false;
    this.saveConfig({ ...this.config, activeSteamId: steamId });
    return true;
  }

  /** Records what Steam last said about an account's key. */
  setAccountStatus(steamId: string, status: AccountStatus): void {
    if (!this.hasAccount(steamId)) return;
    this.saveConfig({
      ...this.config,
      accounts: this.config.accounts.map((a) =>
        a.steamId === steamId ? { ...a, status } : a,
      ),
    });
  }

  /**
   * Forgets an account for good: its key, what was read from Steam and what
   * the user wrote for it. If it was the one in use, another takes its place.
   * Two files must take it, the accounts first. When the notes cannot be
   * written the account is put back, so the removal that is refused leaves
   * everything as it was and can be asked again: an account gone with its
   * notes still in the file would get them back if it were added anew.
   */
  removeAccount(steamId: string): void {
    const before = this.config;
    const accounts = before.accounts.filter((a) => a.steamId !== steamId);
    this.saveConfig({
      ...before,
      accounts,
      activeSteamId:
        before.activeSteamId === steamId
          ? accounts[0]?.steamId
          : before.activeSteamId,
    });
    try {
      const notes = { ...this.userData.accounts };
      delete notes[steamId];
      this.saveUserData({ ...this.userData, accounts: notes });
    } catch (e) {
      try {
        this.saveConfig(before);
      } catch {
        // The disk took the removal and now refuses to undo it: the account
        // stays removed, as its file says, and the caller is told all the same.
      }
      throw e;
    }
    delete this.cache.accounts[steamId];
    this.saveCache();
  }

  /**
   * What was read for an account: the one in use, unless a read that started
   * for another one is only now handing in its result, or asking for what it
   * needs to finish. A result for an account that is gone lands nowhere, and
   * nothing is answered for it.
   */
  private cacheOf(steamId = this.getActiveSteamId() ?? ''): IAccountCache {
    const blank = (): IAccountCache => ({ games: {}, summaries: {} });
    if (steamId !== '' && !this.hasAccount(steamId)) return blank();
    return (this.cache.accounts[steamId] ??= blank());
  }

  /**
   * What was read from Steam is already taken by the time this is called,
   * and written after the delay: a write that fails then has no caller to
   * tell, and what is in memory stays ahead of the file until a later one
   * works. Nothing of the user's is lost by it.
   */
  private saveCache(): void {
    if (this.cacheDelay === 0) {
      this.write('cache.json', this.cache);
      return;
    }
    this.cacheTimer ??= setTimeout(() => this.flush(), this.cacheDelay);
  }

  /** Writes what is waiting to be written; called before the app closes. */
  flush(): void {
    if (this.cacheTimer === null) return;
    clearTimeout(this.cacheTimer);
    this.cacheTimer = null;
    this.write('cache.json', this.cache);
  }

  /** The library of the account in use, or of the one a read started for. */
  getLibrary(owner?: string): IAccountCache['library'] {
    return this.cacheOf(owner).library;
  }

  setLibrary(games: IRawOwnedGame[], now = Date.now(), owner?: string): void {
    this.cacheOf(owner).library = { fetchedAt: now, games };
    this.saveCache();
  }

  getGame(appid: number): IGameView | null {
    return this.cacheOf().games[appid] ?? null;
  }

  setGame(view: IGameView, owner?: string): void {
    this.cacheOf(owner).games[view.appid] = view;
    this.saveCache();
  }

  getSummary(appid: number, owner?: string): ISummaryEntry | null {
    return this.cacheOf(owner).summaries[appid] ?? null;
  }

  setSummaries(entries: Record<string, ISummaryEntry>, owner?: string): void {
    Object.assign(this.cacheOf(owner).summaries, entries);
    this.saveCache();
  }

  getSchema(appid: number): ICacheFile['schemas'][string] | null {
    return this.cache.schemas[appid] ?? null;
  }

  setSchema(
    appid: number,
    items: IRawSchemaAchievement[],
    now = Date.now(),
  ): void {
    this.cache.schemas[appid] = { fetchedAt: now, items };
    this.saveCache();
  }

  getArt(appid: number): IStoreArt | null {
    return this.cache.art[appid] ?? null;
  }

  setArt(entries: Map<number, IStoreArt>): void {
    for (const [appid, art] of entries) this.cache.art[appid] = art;
    this.saveCache();
  }

  getLanguage(): Language {
    return isLanguage(this.settings.language)
      ? this.settings.language
      : DEFAULT_LANGUAGE;
  }

  /** Changing the language drops what came from Steam already translated (achievements and art). */
  setLanguage(language: Language): void {
    if (language === this.getLanguage()) return;
    this.saveSettings({ ...this.settings, language });
    this.dropTranslatedCache();
  }

  /** Achievements and art come from Steam already translated; a cache in another language is useless. */
  private dropTranslatedCache(): void {
    for (const account of Object.values(this.cache.accounts)) {
      account.games = {};
    }
    this.cache.schemas = {};
    this.cache.art = {};
    this.cache.language = this.getLanguage();
    this.saveCache();
  }

  getAchievementSort(): IAchievementSort {
    return parseAchievementSort(this.settings.achievementSort);
  }

  setAchievementSort(sort: IAchievementSort): void {
    this.saveSettings({
      ...this.settings,
      achievementSort: parseAchievementSort(sort),
    });
  }

  getDashboardSort(): IDashboardSort {
    return parseDashboardSort(this.settings.dashboardSort);
  }

  setDashboardSort(sort: IDashboardSort): void {
    this.saveSettings({
      ...this.settings,
      dashboardSort: parseDashboardSort(sort),
    });
  }

  getUpdateAttempt(): string | null {
    const version = this.settings.updateAttempt;
    return typeof version === 'string' ? version : null;
  }

  setUpdateAttempt(version: string | null): void {
    const next = { ...this.settings };
    if (version === null) delete next.updateAttempt;
    else next.updateAttempt = version;
    this.saveSettings(next);
  }

  getPreferences(): IPreferences {
    return {
      rememberWindow:
        this.settings.rememberWindow ?? DEFAULT_PREFERENCES.rememberWindow,
    };
  }

  setPreference<K extends keyof IPreferences>(
    key: K,
    value: IPreferences[K],
  ): IPreferences {
    const next = { ...this.settings, [key]: value };
    // Not remembering means the last size is forgotten too, not kept for later.
    if (key === 'rememberWindow' && !value) delete next.windowBounds;
    this.saveSettings(next);
    return this.getPreferences();
  }

  getWindowBounds(): IBounds | null {
    return WindowBounds.parse(this.settings.windowBounds);
  }

  setWindowBounds(bounds: IBounds): void {
    this.saveSettings({ ...this.settings, windowBounds: bounds });
  }

  getAlwaysOnTop(): boolean {
    return this.settings.alwaysOnTop;
  }

  setAlwaysOnTop(value: boolean): void {
    this.saveSettings({ ...this.settings, alwaysOnTop: value });
  }

  /** The same as `saveConfig`, for what the user wrote. */
  private saveUserData(next: IUserDataFile): void {
    this.write('userdata.json', next);
    this.userData = next;
  }

  /**
   * Whose notes are meant: the account in use, unless a write names the
   * account it was made under. `null` with no account, and for an account
   * that is not saved: a write that arrives after its account was removed
   * must not bring its notes back.
   */
  private notesOwner(owner = this.getActiveSteamId()): string | null {
    return owner && this.hasAccount(owner) ? owner : null;
  }

  getUserData(appid: number): GameUserData {
    const owner = this.notesOwner();
    return (owner && this.userData.accounts[owner]?.[appid]) || {};
  }

  /**
   * `owner` is the account the edit was made under: another one may be in use
   * by the time the write arrives. The interface puts a note that could not
   * be saved back to the saved one, so a refused write must leave that one
   * here too.
   */
  setUserData(
    appid: number,
    achievementId: string,
    data: IAchievementUserData,
    owner?: string,
  ): void {
    const steamId = this.notesOwner(owner);
    // There is nobody to write for: nothing is kept.
    if (!steamId) return;
    const notes = this.userData.accounts[steamId] ?? {};
    const game = { ...notes[appid] };
    const isEmpty =
      data.note.trim() === '' &&
      !data.pinned &&
      (data.checklist?.length ?? 0) === 0;
    if (isEmpty) delete game[achievementId];
    else game[achievementId] = data;
    this.saveUserData({
      ...this.userData,
      accounts: {
        ...this.userData.accounts,
        [steamId]: { ...notes, [appid]: game },
      },
    });
  }
}
