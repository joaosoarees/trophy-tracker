/**
 * How a newer version reaches the user: `manual` means they download it from
 * the release page; the other two belong to systems where the app updates
 * itself.
 */
export type UpdateStatus = 'manual' | 'downloading' | 'ready';

export interface IAppInfo {
  /** Version of the app that is running. */
  version: string;
  /** Version of a later release, when there is one. */
  newVersion: string | null;
  updateStatus: UpdateStatus;
}
