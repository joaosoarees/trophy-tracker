import { type Language, type Messages, messagesFor } from '@shared/i18n';
import { type AccountStatus } from '@shared/types/Account';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';
import { type IProfile } from '@shared/types/Profile';

import {
  type SteamClient,
  SteamError,
  steamErrorMessage,
} from '../steam/client';
import { type Store } from '../storage/Store';

import { checkApiKey, checkPrivacy } from './onboardingChecks';

/** What a failed read says about the key it was made with, when it says anything. */
const STATUS_OF: Partial<Record<SteamError['kind'], AccountStatus>> = {
  'invalid-key': 'rejected',
  'rate-limited': 'rateLimited',
};

/**
 * Whether the app is set up, in which language, which accounts it knows and
 * which one it follows, and the checks that get an account in.
 */
export class SetupService {
  constructor(
    private store: Store,
    private client: SteamClient,
    /** Told when the state changes without the interface having asked for it. */
    private onChange: (state: IAppState) => void = () => {},
  ) {
    this.client.language = this.store.getLanguage();
  }

  /** Messages in the user's language. */
  get messages(): Messages {
    return messagesFor(this.store.getLanguage());
  }

  get isConfigured(): boolean {
    return this.store.getCredentials() !== null;
  }

  getState(): IAppState {
    return {
      configured: this.isConfigured,
      language: this.store.getLanguage(),
      profile: this.store.getProfile(),
      accounts: this.store.getAccounts(),
      activeSteamId: this.store.getActiveSteamId(),
      achievementSort: this.store.getAchievementSort(),
      dashboardSort: this.store.getDashboardSort(),
    };
  }

  /** Runs a read against Steam and turns a failure into a message for the user. */
  async attempt<T>(run: () => Promise<T>): Promise<CheckResult<T>> {
    const steamId = this.store.getActiveSteamId();
    try {
      const value = await run();
      this.mark(steamId, 'valid');
      return { ok: true, value };
    } catch (e) {
      return { ok: false, error: this.noticeFailure(e, steamId) };
    }
  }

  /**
   * Takes note of a failed read and returns the message to show for it. A
   * refused or limited key is recorded on its account: the app stays open
   * with what it had, and says which key needs attention.
   */
  noticeFailure(e: unknown, steamId = this.store.getActiveSteamId()): string {
    if (e instanceof SteamError) {
      const status = STATUS_OF[e.kind];
      if (status) this.mark(steamId, status);
      return steamErrorMessage(this.messages, e);
    }
    console.error(e);
    return this.messages.errors.unexpected;
  }

  /** Records what Steam has just said about an account's key, if it is news. */
  private mark(steamId: string | null, status: AccountStatus): void {
    const account = this.store.getAccounts().find((a) => a.steamId === steamId);
    if (!account || account.status === status) return;
    this.store.setAccountStatus(account.steamId, status);
    this.onChange(this.getState());
  }

  /** Checks the pair for an account that is not in the app yet. */
  checkApiKey(steamId: string, apiKey: string): Promise<CheckResult<IProfile>> {
    if (this.store.getCredentialsOf(steamId.trim()) !== null) {
      return Promise.resolve({
        ok: false,
        error: this.messages.accounts.alreadyAdded,
      });
    }
    return checkApiKey(this.messages, this.client, steamId, apiKey);
  }

  checkPrivacy(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<{ gamesWithPlaytime: number }>> {
    return checkPrivacy(this.messages, this.client, steamId, apiKey);
  }

  /** Adds an account, and starts following it, only if Steam accepts its key. */
  async addAccount(steamId: string, apiKey: string): Promise<IAppState> {
    const check = await this.checkApiKey(steamId, apiKey);
    if (check.ok) {
      this.store.setCredentials(
        { steamId: check.value.steamId, apiKey: apiKey.trim() },
        check.value,
      );
    }
    return this.getState();
  }

  /** Gives a saved account another key, if Steam accepts it for that account. */
  async replaceKey(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<IAppState>> {
    const check = await checkApiKey(
      this.messages,
      this.client,
      steamId,
      apiKey,
    );
    if (!check.ok) return check;
    if (!this.store.hasAccount(steamId)) {
      return { ok: false, error: this.messages.errors.notConfigured };
    }

    const following = this.store.getActiveSteamId();
    this.store.setCredentials({ steamId, apiKey: apiKey.trim() }, check.value);
    // Saving follows the account that was saved; this one was only repaired.
    if (following) this.store.setActiveAccount(following);
    return { ok: true, value: this.getState() };
  }

  /** Asks Steam again about a saved account's key. Steam being unreachable changes nothing. */
  async recheckAccount(steamId: string): Promise<IAppState> {
    const credentials = this.store.getCredentialsOf(steamId);
    if (!credentials) return this.getState();
    try {
      await this.client.getPlayerSummary(credentials);
      this.store.setAccountStatus(steamId, 'valid');
    } catch (e) {
      const status = e instanceof SteamError ? STATUS_OF[e.kind] : undefined;
      if (status) this.store.setAccountStatus(steamId, status);
    }
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

  /** Changing the language also changes what is asked of Steam from now on. */
  setLanguage(language: Language): IAppState {
    this.store.setLanguage(language);
    this.client.language = language;
    return this.getState();
  }
}
