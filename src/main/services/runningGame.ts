import { type SteamClient } from '../steam/client';
import { type ISteamLocal } from '../steam/local';
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
 * profile. The API answer is reused for a while, and when a call fails the
 * last answer stands, so a network hiccup does not look like the game closing.
 */
export function createRunningGameSource({
  local,
  client,
  store,
  now = () => Date.now(),
  interval = API_INTERVAL,
}: IRunningGameDeps): () => Promise<number | null> {
  if (local.tracksRunningGame) return local.getRunningAppId;

  let last: number | null = null;
  let askedAt = -Infinity;
  let askedFor: string | null = null;

  return async () => {
    const credentials = store.getCredentials();
    if (!credentials) return null;
    const isSameAccount = credentials.steamId === askedFor;
    if (isSameAccount && now() - askedAt < interval) return last;
    // Another account's game says nothing about this one.
    if (!isSameAccount) last = null;

    askedAt = now();
    askedFor = credentials.steamId;
    try {
      const { gameid } = await client.getPlayerSummary(credentials);
      const appid = Number(gameid);
      last = gameid !== undefined && Number.isInteger(appid) ? appid : null;
    } catch {
      // Keep the last answer.
    }
    return last;
  };
}
