import { toast } from 'sonner';

import { SettingsService } from '@app/services/SettingsService';
import type { StoreSlice } from '@app/store/Store';
import {
  type AchievementFilter,
  type AchievementSort,
  DEFAULT_ACHIEVEMENT_SORT,
  type IAchievementSort,
} from '@shared/achievementSort';
import {
  type DashboardFilter,
  type DashboardSort,
  DEFAULT_DASHBOARD_SORT,
  type IDashboardSort,
} from '@shared/dashboardSort';
import { type Language, messagesFor } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';
import {
  DEFAULT_PREFERENCES,
  type IDataFolder,
  type IPreferences,
} from '@shared/types/Preferences';

type SettingsStore = {
  /** What the main process knows about the setup; `null` until the first read. */
  appState: IAppState | null;
  alwaysOnTop: boolean;
  /** Choices the main process acts on: the unlock notification, the window. */
  preferences: IPreferences;
  /** Where the app keeps its files; `null` until read. */
  dataFolder: IDataFolder | null;
  /** Order chosen for each list of a game; kept across games and restarts. */
  achievementSort: IAchievementSort;
  /** Order chosen for each list of the dashboard; kept across restarts. */
  dashboardSort: IDashboardSort;
};

type SettingsActions = {
  load: () => Promise<void>;
  /** Takes a fresh state from the main process and syncs the interface language with it. */
  apply: (appState: IAppState) => void;
  toggleAlwaysOnTop: () => Promise<void>;
  setPreference: <K extends keyof IPreferences>(
    key: K,
    value: IPreferences[K],
  ) => Promise<void>;
  /** Opens the data folder, or copies its path where it cannot be opened. */
  openDataFolder: () => Promise<void>;
  setDashboardSort: (
    filter: DashboardFilter,
    sort: DashboardSort,
  ) => Promise<void>;
  setAchievementSort: (
    filter: AchievementFilter,
    sort: AchievementSort,
  ) => Promise<void>;
  /**
   * Achievement names and art come from Steam already translated, so the
   * window is reloaded to guarantee nothing in the old language stays on screen.
   */
  changeLanguage: (language: Language) => Promise<void>;
  /** Erases the key and the SteamID; the app goes back to the onboarding. */
  eraseCredentials: () => Promise<void>;
};

export type SettingsSlice = SettingsStore & SettingsActions;

export const createSettingsSlice: StoreSlice<SettingsSlice> = (set, get) => ({
  appState: null,
  alwaysOnTop: false,
  preferences: DEFAULT_PREFERENCES,
  dataFolder: null,
  achievementSort: DEFAULT_ACHIEVEMENT_SORT,
  dashboardSort: DEFAULT_DASHBOARD_SORT,

  load: async () => {
    const [appState, alwaysOnTop, preferences, dataFolder] = await Promise.all([
      SettingsService.getState(),
      SettingsService.getAlwaysOnTop(),
      SettingsService.getPreferences(),
      SettingsService.getDataFolder(),
    ]);
    get().settings.apply(appState);
    set(
      (prevState) => {
        prevState.settings.alwaysOnTop = alwaysOnTop;
        prevState.settings.preferences = preferences;
        prevState.settings.dataFolder = dataFolder;
      },
      false,
      'settings/load',
    );
  },

  apply: (appState) =>
    set(
      (prevState) => {
        prevState.settings.appState = appState;
        prevState.settings.achievementSort = appState.achievementSort;
        prevState.settings.dashboardSort = appState.dashboardSort;
        prevState.session.language = appState.language;
      },
      false,
      'settings/apply',
    ),

  // Optimistic update: the button responds at once and is put back if the
  // main process could not apply the change.
  toggleAlwaysOnTop: async () => {
    const previous = get().settings.alwaysOnTop;
    const setAlwaysOnTop = (value: boolean, action: string) =>
      set(
        (prevState) => {
          prevState.settings.alwaysOnTop = value;
        },
        false,
        action,
      );

    setAlwaysOnTop(!previous, 'settings/toggleAlwaysOnTop');
    try {
      const applied = await SettingsService.setAlwaysOnTop(!previous);
      if (applied === previous) {
        setAlwaysOnTop(applied, 'settings/alwaysOnTopNotApplied');
      }
    } catch {
      setAlwaysOnTop(previous, 'settings/rollbackAlwaysOnTop');
      toast.error(messagesFor(get().session.language).errors.changeNotSaved);
    }
  },

  // Optimistic update, as in `toggleAlwaysOnTop`.
  setPreference: async (key, value) => {
    const previous = get().settings.preferences;
    const apply = (preferences: IPreferences, action: string) =>
      set(
        (prevState) => {
          prevState.settings.preferences = preferences;
        },
        false,
        action,
      );

    apply({ ...previous, [key]: value }, 'settings/setPreference');
    try {
      apply(
        await SettingsService.setPreference(key, value),
        'settings/preferenceSaved',
      );
    } catch {
      apply(previous, 'settings/rollbackPreference');
      toast.error(messagesFor(get().session.language).errors.changeNotSaved);
    }
  },

  openDataFolder: async () => {
    const m = messagesFor(get().session.language);
    try {
      const done = await SettingsService.openDataFolder();
      if (done === 'copied') toast(m.settings.pathCopied);
    } catch {
      toast.error(m.errors.unexpected);
    }
  },

  // Optimistic update: the list reorders at once; if the preference cannot
  // be saved, the previous order comes back.
  setAchievementSort: async (filter, sort) => {
    const previous = get().settings.achievementSort;
    const next = { ...previous, [filter]: sort };
    const apply = (value: IAchievementSort, action: string) =>
      set(
        (prevState) => {
          prevState.settings.achievementSort = value;
        },
        false,
        action,
      );

    apply(next, 'settings/setAchievementSort');
    try {
      await SettingsService.setAchievementSort(next);
    } catch {
      apply(previous, 'settings/rollbackAchievementSort');
      toast.error(messagesFor(get().session.language).errors.changeNotSaved);
    }
  },

  // Optimistic update, as in `setAchievementSort`.
  setDashboardSort: async (filter, sort) => {
    const previous = get().settings.dashboardSort;
    const next = { ...previous, [filter]: sort };
    const apply = (value: IDashboardSort, action: string) =>
      set(
        (prevState) => {
          prevState.settings.dashboardSort = value;
        },
        false,
        action,
      );

    apply(next, 'settings/setDashboardSort');
    try {
      await SettingsService.setDashboardSort(next);
    } catch {
      apply(previous, 'settings/rollbackDashboardSort');
      toast.error(messagesFor(get().session.language).errors.changeNotSaved);
    }
  },

  changeLanguage: async (language) => {
    if (language === get().session.language) return;
    await SettingsService.setLanguage(language);
    window.location.reload();
  },

  eraseCredentials: async () => {
    get().settings.apply(await SettingsService.resetConfig());
  },
});
