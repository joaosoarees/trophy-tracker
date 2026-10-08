import { type IAppInfo } from '@shared/types/AppInfo';
import { type GuideSite, type ExternalPage } from '@shared/types/Guide';

import { Service } from './Service';

/** Things that happen outside the app window, such as opening the browser. */
export class SystemService extends Service {
  static openGuide(
    site: GuideSite,
    appid: number,
    game: string,
    achievement: string,
  ): Promise<void> {
    return this.api.openGuide(site, appid, game, achievement);
  }

  /** Fire and forget: a failure to log is not worth reporting. */
  static logError(source: string, detail: string): void {
    void this.api.logError(source, detail).catch(() => {});
  }

  static getAppInfo(): Promise<IAppInfo> {
    return this.api.getAppInfo();
  }

  static openExternal(target: ExternalPage): Promise<void> {
    return this.api.openExternal(target);
  }
}
