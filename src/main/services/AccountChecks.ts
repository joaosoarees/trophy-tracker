import { type Messages, messagesFor } from '@shared/i18n';
import { type CheckResult } from '@shared/types/Check';
import { type IProfile } from '@shared/types/Profile';
import { API_KEY_PATTERN, isSteamId } from '@shared/validation';

import { type SteamClient, SteamError } from '../steam/SteamClient';
import { type Store } from '../storage/Store';

import { Dashboard } from './Dashboard';
import { type KeyStatus } from './KeyStatus';

/** The part of `Store` that says which accounts are in the app, and in which language to answer. */
type SavedAccounts = Pick<Store, 'getLanguage' | 'getCredentialsOf'>;

/** The part of `SteamClient` that checks a key, its SteamID and what the profile shows. */
type AccountProbe = Pick<
  SteamClient,
  'getPlayerSummary' | 'getOwnedGames' | 'getPlayerAchievements'
>;

/**
 * The checks a SteamID and its key go through before the app takes them:
 * their formats, whether Steam accepts the pair, and whether the profile
 * shows what the app reads. A check saves nothing and marks no account.
 */
export class AccountChecks {
  constructor(
    private store: SavedAccounts,
    private client: AccountProbe,
    /** What a failure means, described where every failure is. */
    private failures: Pick<KeyStatus, 'interpret'>,
  ) {}

  /** Messages in the user's language. */
  private get messages(): Messages {
    return messagesFor(this.store.getLanguage());
  }

  private static fail(error: string): { ok: false; error: string } {
    return { ok: false, error };
  }

  /** Checks the pair for an account that is not in the app yet. */
  checkApiKey(steamId: string, apiKey: string): Promise<CheckResult<IProfile>> {
    if (this.store.getCredentialsOf(steamId.trim()) !== null) {
      return Promise.resolve(
        AccountChecks.fail(this.messages.accounts.alreadyAdded),
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
      if (games === null) return AccountChecks.fail(m.check.privacyBlocked);
      const played = Dashboard.mostRecentFirst(Dashboard.played(games));

      // A game with no achievements proves nothing; try the most recent ones until one answers.
      for (const game of played.slice(0, 5)) {
        try {
          await this.client.getPlayerAchievements(creds, game.appid);
          break;
        } catch (e) {
          if (e instanceof SteamError && e.kind === 'no-stats') continue;
          if (e instanceof SteamError && e.kind === 'private') {
            return AccountChecks.fail(m.check.privacyBlocked);
          }
          throw e;
        }
      }
      return { ok: true, value: { gamesWithPlaytime: played.length } };
    } catch (e) {
      return AccountChecks.fail(this.failures.interpret(e).message);
    }
  }

  /**
   * The key is valid if Steam accepts an authenticated call, and the SteamID if
   * that call finds its profile. Both are checked together because the key alone
   * does not say whose it is.
   */
  async checkPair(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<IProfile>> {
    const m = this.messages;
    const id = steamId.trim();
    const key = apiKey.trim();
    if (!isSteamId(id)) return AccountChecks.fail(m.validation.steamIdFormat);
    if (!API_KEY_PATTERN.test(key))
      return AccountChecks.fail(m.validation.apiKeyFormat);
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
      return AccountChecks.fail(this.failures.interpret(e).message);
    }
  }
}
