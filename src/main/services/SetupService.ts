import { type Language, type Messages, messagesFor } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';

import { type Store } from '../storage/Store';

import { type AccountChecks } from './AccountChecks';
import { type KeyStatus } from './KeyStatus';

/** The part of `Store` that keeps the accounts, the one in use and the language. */
type SavedSetup = Pick<
  Store,
  | 'getLanguage'
  | 'setLanguage'
  | 'getCredentials'
  | 'getProfile'
  | 'getAccounts'
  | 'getActiveSteamId'
  | 'hasAccount'
  | 'setCredentials'
  | 'setActiveAccount'
  | 'removeAccount'
  | 'getAchievementSort'
  | 'getDashboardSort'
>;

/**
 * Whether the app is set up, in which language, which accounts it knows and
 * which one it follows. An account gets in, or gets another key, only
 * through the checks it is given. A change the disk refuses throws out of
 * the call that asked for it and changes nothing (`Store`), so the state
 * answered after it is the one from before.
 */
export class SetupService {
  constructor(
    private store: SavedSetup,
    private checks: Pick<AccountChecks, 'checkApiKey' | 'checkPair'>,
    private keys: Pick<KeyStatus, 'recheck'>,
  ) {}

  /** Messages in the user's language. */
  get messages(): Messages {
    return messagesFor(this.store.getLanguage());
  }

  get isConfigured(): boolean {
    return this.store.getCredentials() !== null;
  }

  getState(): IAppState {
    return {
      isConfigured: this.isConfigured,
      language: this.store.getLanguage(),
      profile: this.store.getProfile(),
      accounts: this.store.getAccounts(),
      activeSteamId: this.store.getActiveSteamId(),
      achievementSort: this.store.getAchievementSort(),
      dashboardSort: this.store.getDashboardSort(),
    };
  }

  /**
   * Adds an account, and starts following it, only if Steam accepts its key.
   * A refusal saves nothing and says why: the interface checked the pair
   * before asking, but Steam may answer otherwise this time, and the account
   * may have been saved meanwhile.
   */
  async addAccount(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<IAppState>> {
    const check = await this.checks.checkApiKey(steamId, apiKey);
    if (!check.ok) return check;

    this.store.setCredentials(
      { steamId: check.value.steamId, apiKey: apiKey.trim() },
      check.value,
    );
    return { ok: true, value: this.getState() };
  }

  /** Gives a saved account another key, if Steam accepts it for that account. */
  async replaceKey(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<IAppState>> {
    const check = await this.checks.checkPair(steamId, apiKey);
    if (!check.ok) return check;
    if (!this.store.hasAccount(steamId)) {
      return { ok: false, error: this.messages.errors.notConfigured };
    }

    // This account is only repaired: the app stays on the one in use, and in
    // one write, so a disk that refuses cannot leave it on the repaired one.
    this.store.setCredentials({ steamId, apiKey: apiKey.trim() }, check.value, {
      shouldFollow: false,
    });
    return { ok: true, value: this.getState() };
  }

  /** Asks Steam again about a saved account's key, and answers the state after it. */
  async recheckAccount(steamId: string): Promise<IAppState> {
    await this.keys.recheck(steamId);
    return this.getState();
  }

  /** Starts following another saved account. */
  setActiveAccount(steamId: string): IAppState {
    this.store.setActiveAccount(steamId);
    return this.getState();
  }

  /** Forgets an account, with everything kept for it. */
  removeAccount(steamId: string): IAppState {
    this.store.removeAccount(steamId);
    return this.getState();
  }

  /**
   * Changing the language also changes what is asked of Steam from now on:
   * the client asks the store for it on each request.
   */
  setLanguage(language: Language): IAppState {
    this.store.setLanguage(language);
    return this.getState();
  }
}
