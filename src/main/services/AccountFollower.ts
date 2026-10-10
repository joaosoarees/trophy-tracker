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
 */
export class AccountFollower {
  private lastSeen: string | null | undefined;

  constructor(private readonly deps: IAccountFollowerDeps) {}

  /**
   * Follows the client's account if it changed since last looked at (and
   * once as the app opens). Acting only on a change is what lets an account
   * picked by hand stand. Answers whether the app switched.
   */
  async onClientChange(): Promise<boolean> {
    const steamId = await this.signedIn();
    if (steamId === this.lastSeen) return false;
    this.lastSeen = steamId;

    if (steamId === null || steamId === this.deps.store.getActiveSteamId()) {
      return false;
    }
    return this.follow(steamId);
  }

  /**
   * A game has started. It is always the client's account that is playing,
   * so that account is followed whatever was picked by hand. Answers `other`
   * when the game belongs to an account the app does not have, which it
   * cannot show.
   */
  async forRunningGame(): Promise<'followed' | 'other'> {
    const steamId = await this.signedIn();
    // With no way to tell who is playing, it is taken to be the account in use.
    if (steamId === null) return 'followed';
    this.lastSeen = steamId;
    return this.follow(steamId) ? 'followed' : 'other';
  }

  private signedIn(): Promise<string | null> {
    return this.deps.getSignedInSteamId().catch(() => null);
  }

  /** Answers whether the app is now on that account. */
  private follow(steamId: string): boolean {
    const { store, onFollow } = this.deps;
    if (steamId === store.getActiveSteamId()) return true;
    if (!store.setActiveAccount(steamId)) return false;
    onFollow(steamId);
    return true;
  }
}
