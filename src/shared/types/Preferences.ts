/** Choices the user makes in Settings that the main process acts on. */
export interface IPreferences {
  /** Reopen the window with the size and position it was closed with. */
  rememberWindow: boolean;
}

export const DEFAULT_PREFERENCES: IPreferences = {
  rememberWindow: true,
};

/** The folders of the app the user can be shown. */
export type LocalFolderId = 'data' | 'errorLog';

/** Where the app keeps something, and what the "open" action can do here. */
export interface ILocalFolder {
  path: string;
  /** `false` where a file manager cannot be opened on it (WSL): the path is copied instead. */
  canOpen: boolean;
}
