import { toast } from 'sonner';

import { AccountsService } from '@app/services/AccountsService';
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
  type ILocalFolder,
  type LocalFolderId,
  type IPreferences,
} from '@shared/types/Preferences';

type SettingsStore = {
  /** What the main process knows about the setup; `null` until the first read. */
  appState: IAppState | null;
  alwaysOnTop: boolean;
  /** Choices the main process acts on: the unlock notification, the window. */
  preferences: IPreferences;
  /** Where the app keeps its files; `null` until read. */
  /** The folders shown in Settings; `null` until asked. */
  folders: Record<LocalFolderId, ILocalFolder> | null;
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
  openFolder: (id: LocalFolderId) => Promise<void>;
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
  /**
   * Follows another saved account. What was read for the one being left goes
   * off the screen as the state changes (see `connectStore`).
   */
  switchAccount: (steamId: string) => Promise<void>;
  /** Forgets an account; removing the last one leads back to the onboarding. */
  removeAccount: (steamId: string) => Promise<void>;
  /** A state the main process sent by itself; `hasFollowed` when it switched accounts to match Steam. */
  accept: (appState: IAppState, hasFollowed: boolean) => void;
  /**
   * The account step saved or removed an account. With the app set up, the
   * main process is already on that state and the store follows at once.
   * In the first setup the step keeps it until `finishSetup`: taking it here
   * would end the setup at the first account.
   */
  acceptAccountStep: (appState: IAppState) => void;
  /**
   * The first setup ends on the state its account step produced. With the
   * app already set up there is nothing to take: every answer of the step is
   * in the store, and so is whatever the main process sent since.
   */
  finishSetup: (appState: IAppState) => void;
};

export type SettingsSlice = SettingsStore & SettingsActions;

export const createSettingsSlice: StoreSlice<SettingsSlice> = (set, get) => ({
  appState: null,
  alwaysOnTop: false,
  preferences: DEFAULT_PREFERENCES,
  folders: null,
  achievementSort: DEFAULT_ACHIEVEMENT_SORT,
  dashboardSort: DEFAULT_DASHBOARD_SORT,

  load: async () => {
    const [appState, alwaysOnTop, preferences, data, errorLog] =
      await Promise.all([
        SettingsService.getState(),
        SettingsService.getAlwaysOnTop(),
        SettingsService.getPreferences(),
        SettingsService.getFolder('data'),
        SettingsService.getFolder('errorLog'),
      ]);
    get().settings.apply(appState);
    set(
      (prevState) => {
        prevState.settings.alwaysOnTop = alwaysOnTop;
        prevState.settings.preferences = preferences;
        prevState.settings.folders = { data, errorLog };
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
    const isOnBefore = get().settings.alwaysOnTop;
    const setAlwaysOnTop = (value: boolean, action: string) =>
      set(
        (prevState) => {
          prevState.settings.alwaysOnTop = value;
        },
        false,
        action,
      );

    setAlwaysOnTop(!isOnBefore, 'settings/toggleAlwaysOnTop');
    try {
      const isOnNow = await SettingsService.setAlwaysOnTop(!isOnBefore);
      if (isOnNow === isOnBefore) {
        setAlwaysOnTop(isOnNow, 'settings/alwaysOnTopNotApplied');
      }
    } catch {
      setAlwaysOnTop(isOnBefore, 'settings/rollbackAlwaysOnTop');
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

  openFolder: async (id) => {
    const m = messagesFor(get().session.language);
    try {
      const done = await SettingsService.openFolder(id);
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

  switchAccount: async (steamId) => {
    if (steamId === get().settings.appState?.activeSteamId) return;
    // Edits still waiting to be written belong to the account being left.
    get().userData.flush();
    get().settings.apply(await AccountsService.setActive(steamId));
  },

  removeAccount: async (steamId) => {
    get().userData.flush();
    get().settings.apply(await AccountsService.remove(steamId));
  },

  accept: (appState, hasFollowed) => {
    get().settings.apply(appState);
    if (!hasFollowed) return;
    const name = appState.profile?.name || appState.activeSteamId || '';
    toast(messagesFor(appState.language).accounts.switched(name));
  },

  acceptAccountStep: (appState) => {
    if (get().settings.appState?.isConfigured) get().settings.apply(appState);
  },

  finishSetup: (appState) => {
    if (!get().settings.appState?.isConfigured) get().settings.apply(appState);
  },
});
