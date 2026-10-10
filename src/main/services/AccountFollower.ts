import { type Store } from '../storage/Store';

/** The part of `Store` that says which account is in use and changes it. */
type AccountInUse = Pick<Store, 'getActiveSteamId' | 'setActiveAccount'>;

interface IAccountFollowerDeps {
  /**
   * SteamID64 of the account signed in to the Steam client, or `null` when
   * nobody is. Rejects when that could not be read.
   */
  getSignedInSteamId: () => Promise<string | null>;
  store: AccountInUse;
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
   * picked by hand stand. A read that failed says nothing about the client:
   * what was last seen stands, or the account that comes back after it would
   * look like a change. Answers whether the app switched. An account that
   * could not be followed (the disk refused it) was not seen yet: the call
   * rejects, and the next look tries again.
   */
  async onClientChange(): Promise<boolean> {
    const steamId = await this.signedIn();
    if (steamId === undefined || steamId === this.lastSeen) return false;

    const hasSwitched =
      steamId !== null &&
      steamId !== this.deps.store.getActiveSteamId() &&
      this.follow(steamId);
    this.lastSeen = steamId;
    return hasSwitched;
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
    if (steamId === null || steamId === undefined) return 'followed';
    const hasFollowed = this.follow(steamId);
    this.lastSeen = steamId;
    return hasFollowed ? 'followed' : 'other';
  }

  /** Who is signed in to the client; `undefined` when it could not be read. */
  private signedIn(): Promise<string | null | undefined> {
    return this.deps.getSignedInSteamId().catch(() => undefined);
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
