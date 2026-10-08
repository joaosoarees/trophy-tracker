import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useStore } from '@app/store';
import { matches } from '@ui/utils/text';

export function useDashboardController() {
  const { games, isLoading, error, progress, load, pickGame } = useStore(
    useShallow((state) => ({
      games: state.dashboard.games,
      isLoading: state.dashboard.loading,
      error: state.dashboard.error,
      progress: state.dashboard.progress,
      load: state.dashboard.load,
      pickGame: state.navigation.pickGame,
    })),
  );
  const [query, setQuery] = useState('');

  const shownGames = useMemo(
    () => games?.filter((game) => matches(query, game.name)) ?? [],
    [games, query],
  );
  const inProgress =
    games?.filter((game) => game.unlocked < game.total).length ?? 0;

  return {
    games,
    shownGames,
    total: games?.length ?? 0,
    inProgress,
    complete: (games?.length ?? 0) - inProgress,
    isLoading,
    error,
    progress,
    query,
    setQuery,
    handleRefreshAll: () => void load('all'),
    handlePickGame: pickGame,
  };
}
