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
}: IRunningGameDeps): () => Promise<number | null> {
  if (local.tracksRunningGame) return local.getRunningAppId;

  let last: number | null = null;
  let askedAt = -Infinity;

  return async () => {
    const credentials = store.getCredentials();
    if (!credentials) return null;
    if (now() - askedAt < API_INTERVAL) return last;

    askedAt = now();
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
