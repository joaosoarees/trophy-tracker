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

  private saveConfig(): void {
    this.write('config.json', this.config, 0o600);
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
   * it. An account that was already there gets the new key and keeps the rest.
   */
  setCredentials({ steamId, apiKey }: ICredentials, profile: IProfile): void {
    const account: IStoredAccount = {
      steamId,
      ...(this.cipher
        ? { apiKeyEncrypted: this.cipher.encrypt(apiKey) }
        : { apiKey }),
      keyEnding: apiKey.slice(-4),
      profile,
      status: 'valid',
    };
    const index = this.config.accounts.findIndex((a) => a.steamId === steamId);
    if (index === -1) this.config.accounts.push(account);
    else this.config.accounts[index] = account;
    this.config.activeSteamId = steamId;
    this.saveConfig();
  }

  /** Starts following another saved account; answers whether there is one. */
  setActiveAccount(steamId: string): boolean {
    if (!this.hasAccount(steamId)) return false;
    this.config.activeSteamId = steamId;
    this.saveConfig();
    return true;
  }

  /** Records what Steam last said about an account's key. */
  setAccountStatus(steamId: string, status: AccountStatus): void {
    const account = this.config.accounts.find((a) => a.steamId === steamId);
    if (!account) return;
    account.status = status;
    this.saveConfig();
  }

  /**
   * Forgets an account for good: its key, what was read from Steam and what
   * the user wrote for it. If it was the one in use, another takes its place.
   */
  removeAccount(steamId: string): void {
    this.config.accounts = this.config.accounts.filter(
      (a) => a.steamId !== steamId,
    );
    if (this.config.activeSteamId === steamId) {
      this.config.activeSteamId = this.config.accounts[0]?.steamId;
    }
    this.saveConfig();
    delete this.cache.accounts[steamId];
    this.saveCache();
    delete this.userData.accounts[steamId];
    this.saveUserData();
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
    this.settings.language = language;
    this.write('settings.json', this.settings);
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
    this.settings.achievementSort = parseAchievementSort(sort);
    this.write('settings.json', this.settings);
  }

  getDashboardSort(): IDashboardSort {
    return parseDashboardSort(this.settings.dashboardSort);
  }

  setDashboardSort(sort: IDashboardSort): void {
    this.settings.dashboardSort = parseDashboardSort(sort);
    this.write('settings.json', this.settings);
  }

  getUpdateAttempt(): string | null {
    const version = this.settings.updateAttempt;
    return typeof version === 'string' ? version : null;
  }

  setUpdateAttempt(version: string | null): void {
    if (version === null) delete this.settings.updateAttempt;
    else this.settings.updateAttempt = version;
    this.write('settings.json', this.settings);
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
    this.settings[key] = value;
    // Not remembering means the last size is forgotten too, not kept for later.
    if (key === 'rememberWindow' && !value) delete this.settings.windowBounds;
    this.write('settings.json', this.settings);
    return this.getPreferences();
  }

  getWindowBounds(): IBounds | null {
    return WindowBounds.parse(this.settings.windowBounds);
  }

  setWindowBounds(bounds: IBounds): void {
    this.settings.windowBounds = bounds;
    this.write('settings.json', this.settings);
  }

  getAlwaysOnTop(): boolean {
    return this.settings.alwaysOnTop;
  }

  setAlwaysOnTop(value: boolean): void {
    this.settings.alwaysOnTop = value;
    this.write('settings.json', this.settings);
  }

  private saveUserData(): void {
    this.write('userdata.json', this.userData);
  }

  /**
   * What the user wrote for an account: the one in use, unless a write names
   * the account it was made under. `null` with no account, and for an account
   * that is not saved: a write that arrives after its account was removed
   * must not bring its notes back.
   */
  private notesOf(owner = this.getActiveSteamId()): AccountUserData | null {
    if (!owner || !this.hasAccount(owner)) return null;
    return (this.userData.accounts[owner] ??= {});
  }

  getUserData(appid: number): GameUserData {
    return this.notesOf()?.[appid] ?? {};
  }

  /**
   * `owner` is the account the edit was made under: another one may be in use
   * by the time the write arrives.
   */
  setUserData(
    appid: number,
    achievementId: string,
    data: IAchievementUserData,
    owner?: string,
  ): void {
    const notes = this.notesOf(owner);
    // There is nobody to write for: nothing is kept.
    if (!notes) return;
    const game = (notes[appid] ??= {});
    const isEmpty =
      data.note.trim() === '' &&
      !data.pinned &&
      (data.checklist?.length ?? 0) === 0;
    if (isEmpty) delete game[achievementId];
    else game[achievementId] = data;
    this.saveUserData();
  }
}
