import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useLocale } from '@app/hooks/useLocale';
import { useStore } from '@app/store';
import { type AchievementSort } from '@shared/achievementSort';
import {
  type GameUserData,
  type IAchievementUserData,
} from '@shared/types/UserData';

import { listAchievements } from './achievementList';

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
    sorts,
    open,
    load,
    updateUserData,
    dismissUnlocked,
    setFilter,
    setAchievementSort,
  } = useStore(
    useShallow((state) => {
      const entry = state.games.entries[appid];

      return {
        view: entry?.view ?? null,
        isLoading: entry?.loading ?? true,
        error: entry?.error ?? null,
        justUnlocked: entry?.justUnlocked ?? NONE_UNLOCKED,
        userData: state.userData.byGame[appid] ?? NO_USER_DATA,
        // Shared by every game, so they hold when the game changes.
        filter: state.navigation.achievementFilter,
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

  const achievements = useMemo(
    () =>
      view
        ? listAchievements(view, userData, { filter, sort, query, locale })
        : [],
    [view, userData, filter, sort, query, locale],
  );

  const handleUserDataChange = useCallback(
    (achievementId: string, patch: Partial<IAchievementUserData>) =>
      updateUserData(appid, achievementId, patch),
    [updateUserData, appid],
  );

  const pending = view ? view.total - view.unlockedCount : 0;
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
    isComplete: view !== null && view.total > 0 && pending === 0,
    filter,
    sort,
    query,
    setFilter,
    setQuery,
    handleSortChange: (next: AchievementSort) =>
      void setAchievementSort(filter, next),
    handleUserDataChange,
    handleRefresh: () => void load(appid, true),
    handleDismissUnlocked: () => dismissUnlocked(appid),
  };
}
