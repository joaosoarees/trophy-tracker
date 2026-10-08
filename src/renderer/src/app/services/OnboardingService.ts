import { type IAppState } from '@shared/types/AppState';
import { type CheckResult, type SteamIdCheck } from '@shared/types/Check';
import { type IProfile } from '@shared/types/Profile';

import { Service } from './Service';

export class OnboardingService extends Service {
  /** SteamID of the account signed in to the Steam client, if any. */
  static detectSteamId(): Promise<string | null> {
    return this.api.detectSteamId();
  }

  static checkSteamId(steamId: string): Promise<SteamIdCheck> {
    return this.api.checkSteamId(steamId);
  }

  static checkApiKey(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<IProfile>> {
    return this.api.checkApiKey(steamId, apiKey);
  }

  static checkPrivacy(
    steamId: string,
    apiKey: string,
  ): Promise<CheckResult<{ gamesWithPlaytime: number }>> {
    return this.api.checkPrivacy(steamId, apiKey);
  }

  static saveConfig(steamId: string, apiKey: string): Promise<IAppState> {
    return this.api.saveConfig(steamId, apiKey);
  }
}
