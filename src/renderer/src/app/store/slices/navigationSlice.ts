import { safeSessionStorageGetItem } from '@app/lib/safeSessionStorageGetItem';
import type { StoreSlice } from '@app/store/Store';
import {
  type AchievementFilter,
  isAchievementFilter,
} from '@shared/achievementSort';
import { type DashboardFilter, isDashboardFilter } from '@shared/dashboardSort';
import { type Language } from '@shared/i18n';

export type Tab = 'game' | 'dashboard' | 'settings';

type NavigationStore = {
  tab: Tab;
  /** Which list the game screen shows; the same for every game. */
  achievementFilter: AchievementFilter;
  /** Whether the game screen shows only hidden achievements. */
  hiddenOnly: boolean;
  /** Whether the game header shows its details; the same for every game. */
  gameDetailsOpen: boolean;
  /** Which list the dashboard shows. */
  dashboardFilter: DashboardFilter;
  /** Game picked in the dashboard; holds until a game is opened on Steam. */
  pickedAppId: number | null;
  /** Running game the app has already jumped to, so a reload does not jump again. */
  seenRunningAppId: number | null;
  /** Language in use when the user started redoing the setup, or `null` outside of it. */
  reconfiguringFrom: Language | null;
};

type NavigationActions = {
  goTo: (tab: Tab) => void;
  showAchievements: (filter: AchievementFilter) => void;
  showGames: (filter: DashboardFilter) => void;
  toggleHiddenOnly: () => void;
  toggleGameDetails: () => void;
  pickGame: (appid: number) => void;
  /** Opening a game on Steam brings the app to it, once per opened game. */
  followRunningGame: (appid: number | null) => void;
  startReconfiguring: () => void;
  stopReconfiguring: () => void;
};

export type NavigationSlice = NavigationStore & NavigationActions;

// Where the user was survives the window reload of a language change (but not closing the app).
const KEYS = {
  tab: 'view-tab',
  achievementFilter: 'view-achievement-filter',
  dashboardFilter: 'view-dashboard-filter',
  hiddenOnly: 'view-hidden-only',
  gameDetailsOpen: 'view-game-details',
  pickedAppId: 'view-picked',
  seenRunningAppId: 'view-seen-running',
} as const;

function remember(key: keyof typeof KEYS, value: unknown): void {
  sessionStorage.setItem(KEYS[key], JSON.stringify(value));
}

/** The app always opens on what is left to do; the choice only survives a reload. */
function savedFilter(): AchievementFilter {
  const saved = safeSessionStorageGetItem<unknown>(KEYS.achievementFilter);
  return isAchievementFilter(saved) ? saved : 'pending';
}

function savedDashboardFilter(): DashboardFilter {
  const saved = safeSessionStorageGetItem<unknown>(KEYS.dashboardFilter);
  return isDashboardFilter(saved) ? saved : 'ongoing';
}

export const createNavigationSlice: StoreSlice<NavigationSlice> = (
  set,
  get,
) => ({
  tab: safeSessionStorageGetItem<Tab>(KEYS.tab) ?? 'game',
  achievementFilter: savedFilter(),
  dashboardFilter: savedDashboardFilter(),
  hiddenOnly: safeSessionStorageGetItem<unknown>(KEYS.hiddenOnly) === true,
  gameDetailsOpen:
    safeSessionStorageGetItem<unknown>(KEYS.gameDetailsOpen) === true,
  pickedAppId: safeSessionStorageGetItem<number>(KEYS.pickedAppId),
  seenRunningAppId: safeSessionStorageGetItem<number>(KEYS.seenRunningAppId),
  reconfiguringFrom: null,

  goTo: (tab) => {
    remember('tab', tab);
    set(
      (prevState) => {
        prevState.navigation.tab = tab;
      },
      false,
      'navigation/goTo',
    );
  },

  showAchievements: (filter) => {
    remember('achievementFilter', filter);
    set(
      (prevState) => {
        prevState.navigation.achievementFilter = filter;
      },
      false,
      'navigation/showAchievements',
    );
  },

  showGames: (filter) => {
    remember('dashboardFilter', filter);
    set(
      (prevState) => {
        prevState.navigation.dashboardFilter = filter;
      },
      false,
      'navigation/showGames',
    );
  },

  toggleHiddenOnly: () => {
    const hiddenOnly = !get().navigation.hiddenOnly;
    remember('hiddenOnly', hiddenOnly);
    set(
      (prevState) => {
        prevState.navigation.hiddenOnly = hiddenOnly;
      },
      false,
      'navigation/toggleHiddenOnly',
    );
  },

  toggleGameDetails: () => {
    const gameDetailsOpen = !get().navigation.gameDetailsOpen;
    remember('gameDetailsOpen', gameDetailsOpen);
    set(
      (prevState) => {
        prevState.navigation.gameDetailsOpen = gameDetailsOpen;
      },
      false,
      'navigation/toggleGameDetails',
    );
  },

  pickGame: (appid) => {
    remember('pickedAppId', appid);
    remember('tab', 'game');
    remember('hiddenOnly', false);
    set(
      (prevState) => {
        prevState.navigation.pickedAppId = appid;
        prevState.navigation.tab = 'game';
        // A filter the user turned on for another game would leave this one
        // looking empty for no reason they can see.
        prevState.navigation.hiddenOnly = false;
      },
      false,
      'navigation/pickGame',
    );
  },

  followRunningGame: (appid) => {
    if (appid === get().navigation.seenRunningAppId) return;
    remember('seenRunningAppId', appid);
    if (appid !== null) {
      remember('pickedAppId', null);
      remember('tab', 'game');
      remember('hiddenOnly', false);
    }
    set(
      (prevState) => {
        prevState.navigation.seenRunningAppId = appid;
        if (appid === null) return;
        prevState.navigation.pickedAppId = null;
        prevState.navigation.tab = 'game';
        // The app switched games by itself: see `pickGame`.
        prevState.navigation.hiddenOnly = false;
      },
      false,
      'navigation/followRunningGame',
    );
  },

  startReconfiguring: () =>
    set(
      (prevState) => {
        prevState.navigation.reconfiguringFrom = prevState.session.language;
      },
      false,
      'navigation/startReconfiguring',
    ),

  stopReconfiguring: () =>
    set(
      (prevState) => {
        prevState.navigation.reconfiguringFrom = null;
      },
      false,
      'navigation/stopReconfiguring',
    ),
});
