import { type Language, type Messages, messagesFor } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';
import { type CheckResult } from '@shared/types/Check';
import { type IProfile } from '@shared/types/Profile';
import { API_KEY_PATTERN, isSteamId } from '@shared/validation';

import { type SteamClient, SteamError } from '../steam/SteamClient';
import { type Store } from '../storage/Store';

import { Dashboard } from './Dashboard';
import { type KeyStatus } from './KeyStatus';

/** The part of `Store` that keeps the accounts, the one in use and the language. */
type SavedSetup = Pick<
  Store,
  | 'getLanguage'
  | 'setLanguage'
  | 'getCredentials'
  | 'getCredentialsOf'
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

/** The part of `SteamClient` that checks a key, its SteamID and what the profile shows. */
type AccountChecks = Pick<
  SteamClient,
  'getPlayerSummary' | 'getOwnedGames' | 'getPlayerAchievements'
>;

/**
 * Whether the app is set up, in which language, which accounts it knows and
 * which one it follows, and the checks that get an account in.
 */
export class SetupService {
  constructor(
    private store: SavedSetup,
    private client: AccountChecks,
    /** What a failure means, and what Steam says about a saved key. */
    private keys: Pick<KeyStatus, 'interpret' | 'recheck'>,
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
      return SetupService.fail(this.keys.interpret(e).message);
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
      return SetupService.fail(this.keys.interpret(e).message);
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
