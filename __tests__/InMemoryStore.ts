import {
  type IAchievementSort,
  parseAchievementSort,
} from '@shared/achievementSort';
import { type IDashboardSort, parseDashboardSort } from '@shared/dashboardSort';
import { DEFAULT_LANGUAGE, type Language } from '@shared/i18n';
import { type AccountStatus, type IAccount } from '@shared/types/Account';
import { type IGameView } from '@shared/types/Game';
import { type IProfile } from '@shared/types/Profile';

import {
  type ICredentials,
  type IRawOwnedGame,
  type IRawSchemaAchievement,
  type IStoreArt,
} from '../src/main/steam/SteamClient';
import { type ISummaryEntry, type Store } from '../src/main/storage/Store';

/**
 * The methods of `Store` the fake implements: what `Tracker`,
 * `SetupService`, `AccountChecks` and `KeyStatus` use of it, together.
 */
export type ServiceStore = Pick<
  Store,
  | 'getCredentials'
  | 'getCredentialsOf'
  | 'getProfile'
  | 'getActiveSteamId'
  | 'getAccounts'
  | 'hasAccount'
  | 'setCredentials'
  | 'setActiveAccount'
  | 'setAccountStatus'
  | 'removeAccount'
  | 'getLibrary'
  | 'setLibrary'
  | 'getGame'
  | 'setGame'
  | 'getSummary'
  | 'setSummaries'
  | 'getSchema'
  | 'setSchema'
  | 'getArt'
  | 'setArt'
  | 'getLanguage'
  | 'setLanguage'
  | 'getAchievementSort'
  | 'getDashboardSort'
>;

interface ISavedAccount {
  steamId: string;
  /** `null` when the key is kept encrypted and cannot be read. */
  apiKey: string | null;
  keyEnding: string;
  profile: IProfile;
  status: AccountStatus;
}

/** What was read from Steam about one account. */
interface IAccountReads {
  library?: { fetchedAt: number; games: IRawOwnedGame[] };
  games: Map<number, IGameView>;
  summaries: Map<string, ISummaryEntry>;
}

const blank = (): IAccountReads => ({ games: new Map(), summaries: new Map() });

/**
 * `Store` without the disk, for the specs of the services that use one: the
 * accounts, the one in use, the language and what was read from Steam, kept
 * in memory. It answers as the real one does, which
 * `src/main/storage/Store.contract.spec.ts` checks by running the same
 * assertions against both; a difference is fixed here.
 */
export class InMemoryStore implements ServiceStore {
  private accounts: ISavedAccount[] = [];
  private inUse: string | undefined;
  private language: Language = DEFAULT_LANGUAGE;
  /** By SteamID. */
  private reads = new Map<string, IAccountReads>();
  // The same for every account: they describe the game, not the player.
  private schemas = new Map<
    number,
    { fetchedAt: number; items: IRawSchemaAchievement[] }
  >();
  private art = new Map<number, IStoreArt>();

  private find(steamId: string | undefined): ISavedAccount | null {
    return this.accounts.find((a) => a.steamId === steamId) ?? null;
  }

  /**
   * What happens to a saved account when the keyring that encrypted its key
   * is not there any more: it is still listed, but its key cannot be read.
   */
  loseKeyOf(steamId: string): void {
    const account = this.find(steamId);
    if (account) account.apiKey = null;
  }

  getCredentials(): ICredentials | null {
    return this.inUse === undefined ? null : this.getCredentialsOf(this.inUse);
  }

  getCredentialsOf(steamId: string): ICredentials | null {
    const apiKey = this.find(steamId)?.apiKey;
    return apiKey ? { steamId, apiKey } : null;
  }

  getProfile(): IProfile | null {
    return this.find(this.inUse)?.profile ?? null;
  }

  getActiveSteamId(): string | null {
    return this.find(this.inUse)?.steamId ?? null;
  }

  getAccounts(): IAccount[] {
    return this.accounts.map(({ profile, keyEnding, status, apiKey }) => ({
      ...profile,
      keyEnding,
      isKeyEncrypted: apiKey === null,
      status,
    }));
  }

  hasAccount(steamId: string): boolean {
    return this.find(steamId) !== null;
  }

  setCredentials({ steamId, apiKey }: ICredentials, profile: IProfile): void {
    const account: ISavedAccount = {
      steamId,
      apiKey,
      keyEnding: apiKey.slice(-4),
      profile,
      status: 'valid',
    };
    const index = this.accounts.findIndex((a) => a.steamId === steamId);
    if (index === -1) this.accounts.push(account);
    else this.accounts[index] = account;
    this.inUse = steamId;
  }

  setActiveAccount(steamId: string): boolean {
    if (!this.hasAccount(steamId)) return false;
    this.inUse = steamId;
    return true;
  }

  setAccountStatus(steamId: string, status: AccountStatus): void {
    const account = this.find(steamId);
    if (account) account.status = status;
  }

  removeAccount(steamId: string): void {
    this.accounts = this.accounts.filter((a) => a.steamId !== steamId);
    if (this.inUse === steamId) this.inUse = this.accounts[0]?.steamId;
    this.reads.delete(steamId);
  }

  /**
   * What was read for an account: the one in use, unless a read hands in its
   * result for another. A result for an account that is gone lands nowhere.
   */
  private readsOf(steamId = this.getActiveSteamId() ?? ''): IAccountReads {
    if (steamId !== '' && !this.hasAccount(steamId)) return blank();
    let reads = this.reads.get(steamId);
    if (!reads) {
      reads = blank();
      this.reads.set(steamId, reads);
    }
    return reads;
  }

  getLibrary(): IAccountReads['library'] {
    return this.readsOf().library;
  }

  setLibrary(games: IRawOwnedGame[], now = Date.now(), owner?: string): void {
    this.readsOf(owner).library = { fetchedAt: now, games };
  }

  getGame(appid: number): IGameView | null {
    return this.readsOf().games.get(appid) ?? null;
  }

  setGame(view: IGameView, owner?: string): void {
    this.readsOf(owner).games.set(view.appid, view);
  }

  getSummary(appid: number): ISummaryEntry | null {
    return this.readsOf().summaries.get(String(appid)) ?? null;
  }

  setSummaries(entries: Record<string, ISummaryEntry>, owner?: string): void {
    const { summaries } = this.readsOf(owner);
    for (const [appid, entry] of Object.entries(entries)) {
      summaries.set(appid, entry);
    }
  }

  getSchema(
    appid: number,
  ): { fetchedAt: number; items: IRawSchemaAchievement[] } | null {
    return this.schemas.get(appid) ?? null;
  }

  setSchema(
    appid: number,
    items: IRawSchemaAchievement[],
    now = Date.now(),
  ): void {
    this.schemas.set(appid, { fetchedAt: now, items });
  }

  getArt(appid: number): IStoreArt | null {
    return this.art.get(appid) ?? null;
  }

  setArt(entries: Map<number, IStoreArt>): void {
    for (const [appid, art] of entries) this.art.set(appid, art);
  }

  getLanguage(): Language {
    return this.language;
  }

  /** As in the real one, what Steam sent already translated is dropped. */
  setLanguage(language: Language): void {
    if (language === this.language) return;
    this.language = language;
    for (const reads of this.reads.values()) reads.games.clear();
    this.schemas.clear();
    this.art.clear();
  }

  // Nothing these services do changes an order, so it is always the default.
  getAchievementSort(): IAchievementSort {
    return parseAchievementSort(undefined);
  }

  getDashboardSort(): IDashboardSort {
    return parseDashboardSort(undefined);
  }
}
