import { type Store } from '../storage/Store';

interface IAccountFollowerDeps {
  /** SteamID64 of the account signed in to the Steam client, or `null`. */
  getSignedInSteamId: () => Promise<string | null>;
  store: Store;
  /** Called after the app started following another account. */
  onFollow: (steamId: string) => void;
}

export interface IAccountFollower {
  /**
   * Follows the client's account if it changed since last looked at (and
   * once as the app opens). Acting only on a change is what lets an account
   * picked by hand stand. Answers whether the app switched.
   */
  onClientChange: () => Promise<boolean>;
  /**
   * A game has started. It is always the client's account that is playing,
   * so that account is followed whatever was picked by hand. Answers `other`
   * when the game belongs to an account the app does not have, which it
   * cannot show.
   */
  forRunningGame: () => Promise<'followed' | 'other'>;
}

/**
 * Keeps the app on the account signed in to the Steam client, when that
 * account is one of the saved ones: the running game is always that
 * account's, so showing it with another one's achievements would be wrong.
 */
export function createAccountFollower({
  getSignedInSteamId,
  store,
  onFollow,
}: IAccountFollowerDeps): IAccountFollower {
  let lastSeen: string | null | undefined;
  const signedIn = () => getSignedInSteamId().catch(() => null);

  /** Answers whether the app is now on that account. */
  const follow = (steamId: string): boolean => {
    if (steamId === store.getActiveSteamId()) return true;
    if (!store.setActiveAccount(steamId)) return false;
    onFollow(steamId);
    return true;
  };

  return {
    onClientChange: async () => {
      const steamId = await signedIn();
      if (steamId === lastSeen) return false;
      lastSeen = steamId;

      if (steamId === null || steamId === store.getActiveSteamId())
        return false;
      return follow(steamId);
    },

    forRunningGame: async () => {
      const steamId = await signedIn();
      // With no way to tell who is playing, it is taken to be the account in use.
      if (steamId === null) return 'followed';
      lastSeen = steamId;
      return follow(steamId) ? 'followed' : 'other';
    },
  };
}
