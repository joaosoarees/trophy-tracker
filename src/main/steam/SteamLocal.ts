/** What the app learns from the Steam client installed on this computer. */
export interface ISteamLocal {
  /**
   * Whether this system can tell which game is running without asking the
   * Web API. Only Windows can (through the registry).
   */
  readonly canTrackRunningGame: boolean;
  /**
   * AppID of the running game; `null` when none is. Rejects when it could
   * not be read: a caller that takes a failure for no game sees the game
   * close and, at the next read, start again.
   */
  getRunningAppId: () => Promise<number | null>;
  /**
   * SteamID64 of the account signed in to the client; `null` when nobody is.
   * Rejects when it could not be read, which is not the same thing: a caller
   * that takes a failure for a sign-out sees a change of account that never
   * happened.
   */
  getActiveSteamId: () => Promise<string | null>;
  /** Which stat feeds each achievement's counter, from the client's cache. */
  readStatMap: (appid: number) => Promise<Map<string, string>>;
}
