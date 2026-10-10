import { type SteamClient } from '../steam/SteamClient';
import { type ISteamLocal } from '../steam/SteamLocal';
import { type Store } from '../storage/Store';

/** How often the Web API is asked which game is running. */
const API_INTERVAL = 30_000;

interface IRunningGameDeps {
  local: ISteamLocal;
  client: SteamClient;
  store: Store;
  now?: () => number;
  /** How long an answer from the Web API is reused, in milliseconds. */
  interval?: number;
}

/**
 * Which game is running right now. Windows reads it from the registry; the
 * other systems ask the Web API, which reports the game in the player's
 * profile: that of the account signed in to the Steam client when the app
 * has it, since that is the one playing, and otherwise the account in use.
 * The API answer is reused for a while, and when a call fails the
 * last answer stands, so a network hiccup does not look like the game closing.
 */
export class RunningGame {
  private readonly local: ISteamLocal;
  private readonly client: SteamClient;
  private readonly store: Store;
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

  /** AppID of the running game, or `null` when no game is open. */
  async getAppId(): Promise<number | null> {
    if (this.local.canTrackRunningGame) return this.local.getRunningAppId();

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
      const appid = Number(gameid);
      this.last =
        gameid !== undefined && Number.isInteger(appid) ? appid : null;
    } catch {
      // Keep the last answer.
    }
    return this.last;
  }
}
