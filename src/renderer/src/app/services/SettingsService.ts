import { type IAchievementSort } from '@shared/achievementSort';
import { type IDashboardSort } from '@shared/dashboardSort';
import { type Language } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';

import { Service } from './Service';

export class SettingsService extends Service {
  static getState(): Promise<IAppState> {
    return this.api.getState();
  }

  /** Erases the key and the SteamID; notes and checklists are kept. */
  static resetConfig(): Promise<IAppState> {
    return this.api.resetConfig();
  }

  /** Saves the language and drops the translated cache; the caller decides whether to reload. */
  static setLanguage(language: Language): Promise<IAppState> {
    return this.api.setLanguage(language);
  }

  static setAchievementSort(sort: IAchievementSort): Promise<void> {
    return this.api.setAchievementSort(sort);
  }

  static setDashboardSort(sort: IDashboardSort): Promise<void> {
    return this.api.setDashboardSort(sort);
  }

  static getAlwaysOnTop(): Promise<boolean> {
    return this.api.getAlwaysOnTop();
  }

  static setAlwaysOnTop(value: boolean): Promise<boolean> {
    return this.api.setAlwaysOnTop(value);
  }
}
