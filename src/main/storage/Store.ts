import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_LANGUAGE, isLanguage, type Language } from '@shared/i18n';
import { type IGameView } from '@shared/types/Game';
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
} from '../steam/client';

/** Optional cipher for the key (Electron's safeStorage, when there is a keyring). */
export interface ICipher {
  encrypt: (plain: string) => string;
  decrypt: (encoded: string) => string;
}

interface IConfigFile {
  steamId?: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
  profile?: IProfile;
}

export interface ISummaryEntry {
  total: number;
  unlocked: number;
  /** Playtime at the time of the read; if it has not changed, neither have the achievements. */
  playtime: number;
}

interface ICacheFile {
  /** Language the Steam content was read in. */
  language?: string;
  library?: { fetchedAt: number; games: IRawOwnedGame[] };
  games: Record<string, IGameView>;
  summaries: Record<string, ISummaryEntry>;
  art: Record<string, IStoreArt>;
  schemas: Record<
    string,
    { fetchedAt: number; items: IRawSchemaAchievement[] }
  >;
}

interface ISettingsFile {
  alwaysOnTop: boolean;
  language?: string;
}

type UserDataFile = Record<string, GameUserData>;

export class Store {
  private config: IConfigFile;
  private cache: ICacheFile;
  private userData: UserDataFile;
  private settings: ISettingsFile;

  constructor(
    private dir: string,
    private cipher: ICipher | null = null,
  ) {
    mkdirSync(dir, { recursive: true });
    this.config = this.read('config.json', {});
    this.cache = this.read('cache.json', {
      games: {},
      summaries: {},
      art: {},
      schemas: {},
    });
    this.userData = this.read('userdata.json', {});
    this.settings = this.read('settings.json', { alwaysOnTop: false });
    if (this.cache.language !== this.getLanguage()) this.dropTranslatedCache();
  }

  private read<T>(name: string, fallback: T): T {
    const file = join(this.dir, name);
    if (!existsSync(file)) return fallback;
    try {
      return {
        ...fallback,
        ...(JSON.parse(readFileSync(file, 'utf8')) as Partial<T>),
      };
    } catch {
      return fallback;
    }
  }

  private write(name: string, data: unknown, mode?: number): void {
    const file = join(this.dir, name);
    writeFileSync(file, JSON.stringify(data, null, 2), { mode });
    if (mode !== undefined) chmodSync(file, mode);
  }

  getCredentials(): ICredentials | null {
    const { steamId, apiKey, apiKeyEncrypted } = this.config;
    if (!steamId) return null;
    try {
      const key =
        apiKeyEncrypted && this.cipher
          ? this.cipher.decrypt(apiKeyEncrypted)
          : apiKey;
      return key ? { steamId, apiKey: key } : null;
    } catch {
      return null;
    }
  }

  getProfile(): IProfile | null {
    return this.config.profile ?? null;
  }

  setCredentials({ steamId, apiKey }: ICredentials, profile: IProfile): void {
    this.config = this.cipher
      ? { steamId, apiKeyEncrypted: this.cipher.encrypt(apiKey), profile }
      : { steamId, apiKey, profile };
    this.write('config.json', this.config, 0o600);
  }

  clearCredentials(): void {
    this.config = {};
    this.write('config.json', this.config, 0o600);
    this.cache = {
      games: {},
      summaries: {},
      art: this.cache.art,
      schemas: this.cache.schemas,
      language: this.cache.language,
    };
    this.saveCache();
  }

  private saveCache(): void {
    this.write('cache.json', this.cache);
  }

  getLibrary(): ICacheFile['library'] {
    return this.cache.library;
  }

  setLibrary(games: IRawOwnedGame[], now = Date.now()): void {
    this.cache.library = { fetchedAt: now, games };
    this.saveCache();
  }

  getGame(appid: number): IGameView | null {
    return this.cache.games[appid] ?? null;
  }

  setGame(view: IGameView): void {
    this.cache.games[view.appid] = view;
    this.saveCache();
  }

  getSummary(appid: number): ISummaryEntry | null {
    return this.cache.summaries[appid] ?? null;
  }

  setSummaries(entries: Record<string, ISummaryEntry>): void {
    Object.assign(this.cache.summaries, entries);
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
    this.cache.games = {};
    this.cache.schemas = {};
    this.cache.art = {};
    this.cache.language = this.getLanguage();
    this.saveCache();
  }

  getAlwaysOnTop(): boolean {
    return this.settings.alwaysOnTop;
  }

  setAlwaysOnTop(value: boolean): void {
    this.settings.alwaysOnTop = value;
    this.write('settings.json', this.settings);
  }

  getUserData(appid: number): GameUserData {
    return this.userData[appid] ?? {};
  }

  setUserData(
    appid: number,
    achievementId: string,
    data: IAchievementUserData,
  ): void {
    const game = (this.userData[appid] ??= {});
    const empty =
      data.note.trim() === '' &&
      !data.pinned &&
      (data.checklist?.length ?? 0) === 0;
    if (empty) delete game[achievementId];
    else game[achievementId] = data;
    this.write('userdata.json', this.userData);
  }
}
