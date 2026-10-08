import { type IAppInfo } from '@shared/types/AppInfo';

/** Version 1.0.0 running, with no later version known. */
export function makeAppInfo(props: Partial<IAppInfo> = {}): IAppInfo {
  return {
    version: '1.0.0',
    newVersion: null,
    updateStatus: 'manual',
    downloadPercent: null,
    ...props,
  };
}
