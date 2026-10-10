import { toast } from 'sonner';

import { explainFailedCall } from '@app/lib/failedCall';
import { AccountsService } from '@app/services/AccountsService';
import { OnboardingService } from '@app/services/OnboardingService';
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
   * window is reloaded to guarantee nothing in the old language stays on
   * screen. A language that could not be saved is not changed to: the user
   * is told and the main process is put back on the one in use.
   */
  changeLanguage: (language: Language) => Promise<void>;
  /**
   * Follows another saved account. What was read for the one being left goes
   * off the screen as the state changes (see `connectStore`). When the call
   * fails the user is told, and the store follows whichever account the main
   * process was left on, as it does after a removal that fails.
   */
  switchAccount: (steamId: string) => Promise<void>;
  /** Forgets an account; removing the last one leads back to the onboarding. */
  removeAccount: (steamId: string) => Promise<void>;
  /**
   * The account step takes back an account it added. Answers the state
   * after it, which the step hands on as it does an add's (see
   * `acceptAccountStep`): what the main process is left with when the call
   * fails, and `null` when not even that is known. A call that fails tells
   * the user: the X that asks has no line of its own to say it on.
   */
  removeStepAccount: (steamId: string) => Promise<IAppState | null>;
  /**
   * Asks Steam again whether the saved key of an account works, and takes
   * the state after it. A call that fails tells the user: the button that
   * asks has no line of its own to say it on.
   */
  recheckAccount: (steamId: string) => Promise<void>;
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
   * The first setup ends on what the main process holds as it ends, not on
   * the copy the account step kept: the language may have been changed since
   * the last account was saved, and the main process may have followed
   * another account. With several accounts it ends on the one signed in to
   * Steam, or else on the first one added. With the app already set up there
   * is nothing to take: every answer of the step is in the store, and so is
   * whatever the main process sent since.
   */
  finishSetup: () => Promise<void>;
};

export type SettingsSlice = SettingsStore & SettingsActions;

/**
 * For a call about accounts that rejected: tells the user, in the language
 * given, and answers what the main process holds now, `null` when it cannot
 * say either. The main process changes what it holds before it writes it, so
 * a write the disk refused leaves it past the change (the account gone, the
 * other one in use) while the screen still shows what was there before.
 */
async function heldAfterFailure(
  error: unknown,
  language: Language,
): Promise<IAppState | null> {
  toast.error(explainFailedCall(error, messagesFor(language)));
  // No answer here either: the screen keeps what it has.
  return SettingsService.getState().catch(() => null);
}

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
    const previous = get().session.language;
    if (language === previous) return;
    try {
      await SettingsService.setLanguage(language);
    } catch (error) {
      toast.error(explainFailedCall(error, messagesFor(previous)));
      // The main process takes the language before it writes it, so it may
      // be asking Steam in a language the screen is not in. Asking for the
      // previous one puts it back, whether or not that one is written: what
      // matters is what it holds, and the disk still has the previous one.
      await SettingsService.setLanguage(previous).catch(() => undefined);
      return;
    }
    window.location.reload();
  },

  switchAccount: async (steamId) => {
    if (steamId === get().settings.appState?.activeSteamId) return;
    // Edits still waiting to be written belong to the account being left.
    get().userData.flush();
    const next = await AccountsService.setActive(steamId).catch((error) =>
      heldAfterFailure(error, get().session.language),
    );
    if (next) get().settings.apply(next);
  },

  removeAccount: async (steamId) => {
    get().userData.flush();
    const next = await AccountsService.remove(steamId).catch((error) =>
      heldAfterFailure(error, get().session.language),
    );
    if (next) get().settings.apply(next);
  },

  removeStepAccount: async (steamId) =>
    AccountsService.remove(steamId).catch((error) =>
      heldAfterFailure(error, get().session.language),
    ),

  recheckAccount: async (steamId) => {
    try {
      get().settings.apply(await AccountsService.recheck(steamId));
    } catch (error) {
      const m = messagesFor(get().session.language);
      toast.error(explainFailedCall(error, m));
    }
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

  finishSetup: async () => {
    if (get().settings.appState?.isConfigured) return;

    // The state is asked for last: it is the one the setup ends on.
    const signedIn = await OnboardingService.detectSteamId();
    let next = await SettingsService.getState();
    const first =
      next.accounts.find((account) => account.steamId === signedIn) ??
      next.accounts.at(0);
    if (first && first.steamId !== next.activeSteamId) {
      next = await AccountsService.setActive(first.steamId);
    }
    get().settings.apply(next);
  },
});
