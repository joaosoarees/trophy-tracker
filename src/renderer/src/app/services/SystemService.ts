import { type GuideSite } from '@shared/types';

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

  static openExternal(target: SystemService.ExternalPage): Promise<void> {
    return this.api.openExternal(target);
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SystemService {
  export type ExternalPage = 'apikey' | 'privacy' | 'account';
}
