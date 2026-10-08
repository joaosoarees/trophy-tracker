export interface IAppInfo {
  /** Version of the app that is running. */
  version: string;
  /** Version of a later release, when there is one to download. */
  newVersion: string | null;
}
