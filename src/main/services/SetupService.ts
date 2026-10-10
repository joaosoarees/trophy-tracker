import { type Language, type Messages, messagesFor } from '@shared/i18n';
import { type AccountStatus } from '@shared/types/Account';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';
import { type IProfile } from '@shared/types/Profile';
import { API_KEY_PATTERN, isSteamId } from '@shared/validation';

import { type SteamClient, SteamError } from '../steam/SteamClient';
import { type Store } from '../storage/Store';

import { Dashboard } from './Dashboard';

/** What a failed read says about the key it was made with, when it says anything. */
const STATUS_OF: Partial<Record<SteamError['kind'], AccountStatus>> = {
  'invalid-key': 'rejected',
  'rate-limited': 'rateLimited',
};

/** What a failure means, whichever call met it. */
interface IFailure {
  /** What it says about the key the call was made with, when it says anything. */
  status: AccountStatus | undefined;
  /** What to show the user for it. */
  message: string;
}

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
    private logError: (source: string, detail: string) => void = () => {},
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
    const { status, message } = this.interpret(e);
    if (status) this.mark(steamId, status);
    return message;
  }

  /**
   * The one place a failure is described. Steam's own failures are expected
   * and have their message; anything else is a fault of the app, which goes
   * to the error log while the user is told only that it happened.
   */
  private interpret(e: unknown): IFailure {
    if (e instanceof SteamError) {
      return { status: STATUS_OF[e.kind], message: e.describe(this.messages) };
    }
    this.logError(
      'main: steam read',
      e instanceof Error ? (e.stack ?? e.message) : String(e),
    );
    return { status: undefined, message: this.messages.errors.unexpected };
  }

  /** Records what Steam has just said about an account's key, and tells the interface if it is news. */
  private mark(steamId: string | null, status: AccountStatus): void {
    if (this.record(steamId, status)) this.onChange(this.getState());
  }

  /** Writes an account's key status down when it differs; answers whether it did. */
  private record(steamId: string | null, status: AccountStatus): boolean {
    const account = this.store.getAccounts().find((a) => a.steamId === steamId);
    if (!account || account.status === status) return false;
    this.store.setAccountStatus(account.steamId, status);
    return true;
  }

  private static fail(error: string): { ok: false; error: string } {
    return { ok: false, error };
  }

  /** Checks the pair for an account that is not in the app yet. */
  checkApiKey(steamId: string, apiKey: string): Promise<CheckResult<IProfile>> {
    if (this.store.getCredentialsOf(steamId.trim()) !== null) {
      return Promise.resolve(
        SetupService.fail(this.messages.accounts.alreadyAdded),
      );
    }
    return this.checkPair(steamId, apiKey);
  }

  /** The library and the achievements must be visible to the Web API. */
  async checkPrivacy(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<{ gamesWithPlaytime: number }>> {
    const m = this.messages;
    const creds = { steamId: steamId.trim(), apiKey: apiKey.trim() };
    try {
      const games = await this.client.getOwnedGames(creds);
      if (games === null) return SetupService.fail(m.check.privacyBlocked);
      const played = Dashboard.mostRecentFirst(Dashboard.played(games));

      // A game with no achievements proves nothing; try the most recent ones until one answers.
      for (const game of played.slice(0, 5)) {
        try {
          await this.client.getPlayerAchievements(creds, game.appid);
          break;
        } catch (e) {
          if (e instanceof SteamError && e.kind === 'no-stats') continue;
          if (e instanceof SteamError && e.kind === 'private') {
            return SetupService.fail(m.check.privacyBlocked);
          }
          throw e;
        }
      }
      return { ok: true, value: { gamesWithPlaytime: played.length } };
    } catch (e) {
      return SetupService.fail(this.interpret(e).message);
    }
  }

  /**
   * The key is valid if Steam accepts an authenticated call, and the SteamID if
   * that call finds its profile. Both are checked together because the key alone
   * does not say whose it is.
   */
  private async checkPair(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<IProfile>> {
    const m = this.messages;
    const id = steamId.trim();
    const key = apiKey.trim();
    if (!isSteamId(id)) return SetupService.fail(m.validation.steamIdFormat);
    if (!API_KEY_PATTERN.test(key))
      return SetupService.fail(m.validation.apiKeyFormat);
    try {
      const p = await this.client.getPlayerSummary({
        steamId: id,
        apiKey: key,
      });
      return {
        ok: true,
        value: {
          steamId: p.steamid,
          name: p.personaname,
          avatar: p.avatarfull,
        },
      };
    } catch (e) {
      return SetupService.fail(this.interpret(e).message);
    }
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
    const check = await this.checkPair(steamId, apiKey);
    if (!check.ok) return check;
    if (!this.store.hasAccount(steamId)) {
      return SetupService.fail(this.messages.errors.notConfigured);
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
      this.record(steamId, 'valid');
    } catch (e) {
      const { status } = this.interpret(e);
      if (status) this.record(steamId, status);
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

  /**
   * Changing the language also changes what is asked of Steam from now on:
   * the client asks the store for it on each request.
   */
  setLanguage(language: Language): IAppState {
    this.store.setLanguage(language);
    return this.getState();
  }
}
