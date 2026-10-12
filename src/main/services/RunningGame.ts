import { type SteamClient } from '../steam/SteamClient';
import { type ISteamLocal } from '../steam/SteamLocal';
import { type Store } from '../storage/Store';

/** How often the Web API is asked which game is running. */
const API_INTERVAL = 30_000;

/** The part of `SteamClient` that reads a player's profile. */
type Profiles = Pick<SteamClient, 'getPlayerSummary'>;

/** The part of `Store` that hands out the saved accounts' credentials. */
type SavedCredentials = Pick<Store, 'getCredentials' | 'getCredentialsOf'>;

interface IRunningGameDeps {
  local: ISteamLocal;
  client: Profiles;
  store: SavedCredentials;
  now?: () => number;
  /** How long an answer from the Web API is reused, in milliseconds. */
  interval?: number;
}

/**
 * Which game is running right now. Windows reads it from the registry; the
 * other systems ask the Web API, which reports the game in the player's
 * profile: that of the account signed in to the Steam client when the app
 * has it, since that is the one playing, and otherwise the account in use.
 * The API answer is reused for a while. When a read fails, of the registry
 * or of the API, the last answer stands, so a command that timed out or a
 * network hiccup does not look like the game closing.
 */
export class RunningGame {
  private readonly local: ISteamLocal;
  private readonly client: Profiles;
  private readonly store: SavedCredentials;
  private readonly now: () => number;
  private readonly interval: number;

  private last: number | null = null;
  private askedAt = -Infinity;
  private askedFor: string | null = null;

  constructor({
    local,
    client,
    store,
    now = () => Date.now(),
    interval = API_INTERVAL,
  }: IRunningGameDeps) {
    this.local = local;
    this.client = client;
    this.store = store;
    this.now = now;
    this.interval = interval;
  }

  /**
   * The appid a profile's `gameid` stands for, `null` when it is not one: no
   * game, an empty text, or the 64-bit id Steam gives a game that is not its
   * own, which no number here holds and no achievement list answers for.
   */
  private static appIdOf(gameid: string | undefined): number | null {
    const appid = Number(gameid);
    return Number.isSafeInteger(appid) && appid > 0 ? appid : null;
  }

  /** AppID of the running game, or `null` when no game is open. */
  async getAppId(): Promise<number | null> {
    if (this.local.canTrackRunningGame) {
      this.last = await this.local.getRunningAppId().catch(() => this.last);
      return this.last;
    }

    const inUse = this.store.getCredentials();
    if (!inUse) return null;

    const signedIn = await this.local.getActiveSteamId().catch(() => null);
    const credentials =
      (signedIn ? this.store.getCredentialsOf(signedIn) : null) ?? inUse;
    const isSameAccount = credentials.steamId === this.askedFor;
    if (isSameAccount && this.now() - this.askedAt < this.interval) {
      return this.last;
    }
    // Another account's game says nothing about this one.
    if (!isSameAccount) this.last = null;

    this.askedAt = this.now();
    this.askedFor = credentials.steamId;
    try {
      const { gameid } = await this.client.getPlayerSummary(credentials);
      this.last = RunningGame.appIdOf(gameid);
    } catch {
      // Keep the last answer.
    }
    return this.last;
  }
}
