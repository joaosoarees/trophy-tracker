import { type Store } from '../storage/Store';

interface IAccountFollowerDeps {
  /** SteamID64 of the account signed in to the Steam client, or `null`. */
  getSignedInSteamId: () => Promise<string | null>;
  store: Store;
  /** Called after the app started following another account. */
  onFollow: (steamId: string) => void;
}

/**
 * Keeps the app on the account signed in to the Steam client, when that
 * account is one of the saved ones: the running game is always that
 * account's, so showing it with another one's achievements would be wrong.
 *
 * It acts only when the client's account changes (and once as the app
 * opens), so an account the user picked by hand is not taken back from them
 * a few seconds later.
 */
export function createAccountFollower({
  getSignedInSteamId,
  store,
  onFollow,
}: IAccountFollowerDeps): () => Promise<void> {
  let lastSeen: string | null | undefined;

  return async () => {
    const signedIn = await getSignedInSteamId().catch(() => null);
    if (signedIn === lastSeen) return;
    lastSeen = signedIn;

    if (signedIn === null || signedIn === store.getActiveSteamId()) return;
    if (store.setActiveAccount(signedIn)) onFollow(signedIn);
  };
}
