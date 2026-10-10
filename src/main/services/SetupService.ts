import { type Language, type Messages, messagesFor } from '@shared/i18n';
import { type AccountStatus } from '@shared/types/Account';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';
import { type IProfile } from '@shared/types/Profile';
import { API_KEY_PATTERN, isSteamId } from '@shared/validation';

import { type SteamClient, SteamError } from '../steam/SteamClient';
import { type Store } from '../storage/Store';

const fail = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});

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
    if (e instanceof SteamError) {
      const status = STATUS_OF[e.kind];
      if (status) this.mark(steamId, status);
      return e.describe(this.messages);
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
      return Promise.resolve(fail(this.messages.accounts.alreadyAdded));
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
      if (games === null) return fail(m.check.privacyBlocked);
      const played = games
        .filter((g) => g.playtime_forever > 0)
        .sort(
          (a, b) => (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0),
        );

      // A game with no achievements proves nothing; try the most recent ones until one answers.
      for (const game of played.slice(0, 5)) {
        try {
          await this.client.getPlayerAchievements(creds, game.appid);
          break;
        } catch (e) {
          if (e instanceof SteamError && e.kind === 'no-stats') continue;
          if (e instanceof SteamError && e.kind === 'private') {
            return fail(m.check.privacyBlocked);
          }
          throw e;
        }
      }
      return { ok: true, value: { gamesWithPlaytime: played.length } };
    } catch (e) {
      return fail(this.describe(e));
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
    if (!isSteamId(id)) return fail(m.validation.steamIdFormat);
    if (!API_KEY_PATTERN.test(key)) return fail(m.validation.apiKeyFormat);
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
      return fail(this.describe(e));
    }
  }

  private describe(e: unknown): string {
    return e instanceof SteamError
      ? e.describe(this.messages)
      : this.messages.errors.unexpected;
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
      return fail(this.messages.errors.notConfigured);
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
