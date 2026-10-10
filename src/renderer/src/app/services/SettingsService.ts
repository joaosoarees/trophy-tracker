import { type IAchievementSort } from '@shared/achievementSort';
import { type IDashboardSort } from '@shared/dashboardSort';
import { type Language } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';
import {
  type ILocalFolder,
  type IPreferences,
  type LocalFolderId,
} from '@shared/types/Preferences';

import { Service } from './Service';

export class SettingsService extends Service {
  static getState(): Promise<IAppState> {
    return this.api.getState();
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

  static getPreferences(): Promise<IPreferences> {
    return this.api.getPreferences();
  }

  static setPreference<K extends keyof IPreferences>(
    key: K,
    value: IPreferences[K],
  ): Promise<IPreferences> {
    return this.api.setPreference(key, value);
  }

  static getFolder(id: LocalFolderId): Promise<ILocalFolder> {
    return this.api.getFolder(id);
  }

  /** Opens the data folder or, where that cannot be done, copies its path. */
  static openFolder(id: LocalFolderId): Promise<'opened' | 'copied'> {
    return this.api.openFolder(id);
  }
}
