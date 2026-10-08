import { type IAppInfo } from './types/AppInfo';

/** Whether a new version is being downloaded, or waiting, to be installed by the app itself. */
export const isUpdatingItself = (info: IAppInfo | null): boolean =>
  info !== null &&
  info.newVersion !== null &&
  (info.updateStatus === 'downloading' || info.updateStatus === 'ready');

/** Whether there is a new version the user has to fetch (or cannot install) themselves. */
export const needsTheUser = (info: IAppInfo | null): boolean =>
  info !== null &&
  info.newVersion !== null &&
  (info.updateStatus === 'manual' || info.updateStatus === 'blocked');
