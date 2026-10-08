import { toast } from 'sonner';

import { SettingsService } from '@app/services/SettingsService';
import type { StoreSlice } from '@app/store/Store';
import {
  type AchievementFilter,
  type AchievementSort,
  DEFAULT_ACHIEVEMENT_SORT,
  type IAchievementSort,
} from '@shared/achievementSort';
import { type Language, messagesFor } from '@shared/i18n';
import { type IAppState } from '@shared/types/AppState';

type SettingsStore = {
  /** What the main process knows about the setup; `null` until the first read. */
  appState: IAppState | null;
  alwaysOnTop: boolean;
  /** Order chosen for each list of a game; kept across games and restarts. */
  achievementSort: IAchievementSort;
};

type SettingsActions = {
  load: () => Promise<void>;
  /** Takes a fresh state from the main process and syncs the interface language with it. */
  apply: (appState: IAppState) => void;
  toggleAlwaysOnTop: () => Promise<void>;
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
  achievementSort: DEFAULT_ACHIEVEMENT_SORT,

  load: async () => {
    const [appState, alwaysOnTop] = await Promise.all([
      SettingsService.getState(),
      SettingsService.getAlwaysOnTop(),
    ]);
    get().settings.apply(appState);
    set(
      (prevState) => {
        prevState.settings.alwaysOnTop = alwaysOnTop;
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

  changeLanguage: async (language) => {
    if (language === get().session.language) return;
    await SettingsService.setLanguage(language);
    window.location.reload();
  },

  eraseCredentials: async () => {
    get().settings.apply(await SettingsService.resetConfig());
  },
});
