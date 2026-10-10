import {
  type GameUserData,
  type IAchievementUserData,
} from '@shared/types/UserData';

import { Service } from './Service';

/** Notes, pins and checklists the user keeps per achievement. */
export class UserDataService extends Service {
  static getUserData(appid: number): Promise<GameUserData> {
    return this.api.getUserData(appid);
  }

  /** `steamId` is the account the edit was made under. */
  static setUserData(
    appid: number,
    achievementId: string,
    data: IAchievementUserData,
    steamId: string,
  ): Promise<void> {
    return this.api.setUserData(appid, achievementId, data, steamId);
  }
}
