/** Choices the user makes in Settings that the main process acts on. */
export interface IPreferences {
  /** Show a system notification when an achievement is unlocked. */
  notifyUnlocks: boolean;
  /** Reopen the window with the size and position it was closed with. */
  rememberWindow: boolean;
}

export const DEFAULT_PREFERENCES: IPreferences = {
  notifyUnlocks: true,
  rememberWindow: true,
};

/** Where the app keeps its files, and what the "open" action can do here. */
export interface IDataFolder {
  path: string;
  /** `false` where a file manager cannot be opened on it (WSL): the path is copied instead. */
  canOpen: boolean;
}
