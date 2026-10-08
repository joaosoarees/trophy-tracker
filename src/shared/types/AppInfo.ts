/**
 * How a newer version reaches the user: `manual` means they download it from
 * the release page; `downloading` and `ready` belong to systems where the app
 * updates itself; `blocked` means the system would refuse to install it.
 */
export type UpdateStatus = 'manual' | 'downloading' | 'ready' | 'blocked';

/** Answer to a check the user asked for. */
export interface IUpdateCheck {
  /** `false` when the check could not be made (offline, for instance). */
  ok: boolean;
  info: IAppInfo;
}

export interface IAppInfo {
  /** Version of the app that is running. */
  version: string;
  /** Version of a later release, when there is one. */
  newVersion: string | null;
  updateStatus: UpdateStatus;
}
