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

  static openExternal(target: ExternalPage): Promise<void> {
    return this.api.openExternal(target);
  }
}
