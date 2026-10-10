import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useLocale } from '@app/hooks/useLocale';
import { useStore } from '@app/store';
import {
  type AchievementFilter,
  type AchievementSort,
} from '@shared/achievementSort';
import { type IAchievement } from '@shared/types/Achievement';
import {
  type GameUserData,
  type IAchievementUserData,
} from '@shared/types/UserData';

import {
  completionOf,
  countHidden,
  countMatchesInOtherList,
  listAchievements,
} from './achievementList';
import { gameDetailsOf } from './gameDetails';

// Stable defaults: a new array or object on every render would re-render the screen each time.
const NONE_UNLOCKED: string[] = [];
const NO_USER_DATA: GameUserData = {};

export function useGameController(appid: number) {
  const locale = useLocale();
  const {
    view,
    isLoading,
    error,
    justUnlocked,
    userData,
    filter,
    isHiddenOnlyChosen,
    isDetailsOpen,
    toggleDetails,
    summary,
    sorts,
    open,
    toggleHiddenOnly,
    load,
    updateUserData,
    dismissUnlocked,
    setFilter,
    setAchievementSort,
  } = useStore(
    useShallow((state) => {
      const entry = state.games.entries[appid];
      const appState = state.settings.appState;
      // The notice over the app already says so; with the game on screen,
      // its header does not say it a second time.
      const isKeyRefused =
        entry?.view != null &&
        appState?.accounts.some(
          (account) =>
            account.steamId === appState.activeSteamId &&
            account.status === 'rejected',
        ) === true;

      return {
        view: entry?.view ?? null,
        isLoading: entry?.isLoading ?? true,
        error: isKeyRefused ? null : (entry?.error ?? null),
        justUnlocked: entry?.justUnlocked ?? NONE_UNLOCKED,
        userData: state.userData.byGame[appid] ?? NO_USER_DATA,
        // Shared by every game, so they hold when the game changes.
        filter: state.navigation.achievementFilter,
        isHiddenOnlyChosen: state.navigation.isHiddenOnly,
        isDetailsOpen: state.navigation.isGameDetailsOpen,
        toggleDetails: state.navigation.toggleGameDetails,
        // Playtime comes with the library, which the dashboard reads.
        summary:
          state.dashboard.games?.find((game) => game.appid === appid) ?? null,
        toggleHiddenOnly: state.navigation.toggleHiddenOnly,
        sorts: state.settings.achievementSort,
        setFilter: state.navigation.showAchievements,
        setAchievementSort: state.settings.setAchievementSort,
        open: state.games.open,
        load: state.games.load,
        updateUserData: state.userData.update,
        dismissUnlocked: state.games.dismissUnlocked,
      };
    }),
  );
  // The search is about one game, so it stays with the screen.
  const [query, setQuery] = useState('');
  const sort = sorts[filter];

  useEffect(() => open(appid), [open, appid]);

  const hiddenCount = view ? countHidden(view, filter) : 0;
  // With nothing hidden in this list the toggle is not drawn, so it must not
  // filter either: the list would be empty with no control to explain it.
  const isHiddenOnly = isHiddenOnlyChosen && hiddenCount > 0;

  const achievements = useMemo(
    () =>
      view
        ? listAchievements(view, userData, {
            filter,
            sort,
            query,
            locale,
            isHiddenOnly,
          })
        : [],
    [view, userData, filter, sort, query, locale, isHiddenOnly],
  );

  const handleUserDataChange = useCallback(
    (achievementId: string, patch: Partial<IAchievementUserData>) =>
      updateUserData(appid, achievementId, patch),
    [updateUserData, appid],
  );

  const pending = view ? view.total - view.unlockedCount : 0;
  const isComplete = view !== null && view.total > 0 && pending === 0;
  const completion = useMemo(
    () => (view && isComplete ? completionOf(view) : null),
    [view, isComplete],
  );
  const details = useMemo(
    () => (view ? gameDetailsOf(view, userData) : null),
    [view, userData],
  );
  const otherFilter: AchievementFilter =
    filter === 'pending' ? 'unlocked' : 'pending';
  const percent =
    !view || view.total === 0
      ? 0
      : Math.round((view.unlockedCount / view.total) * 100);

  return {
    view,
    isLoading,
    error,
    justUnlocked,
    userData,
    achievements,
    pending,
    percent,
    isComplete,
    completion,
    details,
    isDetailsOpen,
    playtimeMinutes: summary?.playtimeMinutes ?? null,
    lastPlayed: summary?.lastPlayed ?? null,
    handleToggleDetails: toggleDetails,
    // Shows one achievement: its list, with the search set to its name.
    handleFindAchievement: (achievement: IAchievement) => {
      setFilter(achievement.unlocked ? 'unlocked' : 'pending');
      // The user asked for this one: a filter that would hide it goes off.
      if (isHiddenOnlyChosen && !achievement.hidden) toggleHiddenOnly();
      setQuery(achievement.name);
    },
    otherFilter,
    // A search that finds nothing here may have matches one tab away.
    matchesInOtherList: view ? countMatchesInOtherList(view, filter, query) : 0,
    filter,
    sort,
    query,
    isHiddenOnly,
    hiddenCount,
    handleToggleHiddenOnly: toggleHiddenOnly,
    handleFilterChange: setFilter,
    handleQueryChange: setQuery,
    handleClearSearch: () => setQuery(''),
    handleShowOtherList: () => setFilter(otherFilter),
    handleShowUnlocked: () => setFilter('unlocked'),
    handleSortChange: (next: AchievementSort) =>
      void setAchievementSort(filter, next),
    handleUserDataChange,
    handleRefresh: () => void load(appid, true),
    handleDismissUnlocked: () => dismissUnlocked(appid),
  };
}
