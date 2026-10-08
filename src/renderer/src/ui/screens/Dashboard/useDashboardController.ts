import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useLocale } from '@app/hooks/useLocale';
import { useStore } from '@app/store';
import {
  type DashboardFilter,
  type DashboardSort,
} from '@shared/dashboardSort';
import { type IGameSummary } from '@shared/types/Game';

import { countGames, listGames } from './gameList';

const NO_GAMES: IGameSummary[] = [];

export function useDashboardController() {
  const locale = useLocale();
  const {
    games,
    isLoading,
    error,
    progress,
    filter,
    sorts,
    load,
    pickGame,
    setFilter,
    setDashboardSort,
  } = useStore(
    useShallow((state) => ({
      games: state.dashboard.games,
      isLoading: state.dashboard.loading,
      error: state.dashboard.error,
      progress: state.dashboard.progress,
      filter: state.navigation.dashboardFilter,
      sorts: state.settings.dashboardSort,
      load: state.dashboard.load,
      pickGame: state.navigation.pickGame,
      setFilter: state.navigation.showGames,
      setDashboardSort: state.settings.setDashboardSort,
    })),
  );
  const [query, setQuery] = useState('');
  const sort = sorts[filter];

  const shownGames = useMemo(
    () => listGames(games ?? NO_GAMES, { filter, sort, query, locale }),
    [games, filter, sort, query, locale],
  );
  const counts = useMemo(
    () => countGames(games ?? NO_GAMES, query),
    [games, query],
  );

  const otherFilter: DashboardFilter =
    filter === 'ongoing' ? 'complete' : 'ongoing';

  return {
    hasLoaded: games !== null,
    shownGames,
    counts,
    isLoading,
    error,
    progress,
    filter,
    sort,
    query,
    otherFilter,
    /** Matches of the search that sit in the list not being shown. */
    matchesInOtherList: query.trim() === '' ? 0 : counts.matching[otherFilter],
    setFilter,
    setQuery,
    handleSortChange: (next: DashboardSort) =>
      void setDashboardSort(filter, next),
    handleRefreshAll: () => void load('all'),
    handlePickGame: pickGame,
  };
}
