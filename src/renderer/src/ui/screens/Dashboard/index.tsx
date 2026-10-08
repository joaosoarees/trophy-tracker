import { RefreshCw } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { Empty } from '@ui/components/Empty';
import { IconButton } from '@ui/components/IconButton';
import { Button } from '@ui/primitives/button';
import { Skeleton } from '@ui/primitives/skeleton';
import { cn } from '@ui/utils/cn';

import { DashboardToolbar } from './components/DashboardToolbar';
import { GameRow } from './components/GameRow';
import { useDashboardController } from './useDashboardController';

const SKELETON_ROWS = Array.from({ length: 6 }, (_, index) => index);

export function Dashboard() {
  const t = useT();
  const {
    hasLoaded,
    shownGames,
    counts,
    isLoading,
    error,
    progress,
    filter,
    sort,
    query,
    otherFilter,
    matchesInOtherList,
    setFilter,
    setQuery,
    handleSortChange,
    handleRefreshAll,
    handlePickGame,
  } = useDashboardController();

  return (
    <section className="flex-1 overflow-y-auto p-4">
      <header className="mb-3">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-xl font-semibold">{t.dashboard.title}</h1>
          <IconButton
            label={t.dashboard.refreshAll}
            disabled={isLoading}
            onClick={handleRefreshAll}
          >
            <RefreshCw className={cn(isLoading && 'animate-spin')} />
          </IconButton>
        </div>
        {isLoading && (
          <p className="text-muted-foreground text-xs">
            {progress
              ? t.dashboard.reading(progress[0], progress[1])
              : t.dashboard.loadingLibrary}
          </p>
        )}
        {error && <p className="text-destructive mt-1">{error}</p>}
      </header>

      {hasLoaded && (
        <DashboardToolbar
          filter={filter}
          sort={sort}
          query={query}
          ongoing={counts.ongoing}
          complete={counts.complete}
          onFilterChange={setFilter}
          onSortChange={handleSortChange}
          onQueryChange={setQuery}
        />
      )}

      {hasLoaded && !isLoading && shownGames.length === 0 && (
        <Empty>
          {query.trim() !== ''
            ? t.dashboard.nothingFound(query.trim())
            : counts.ongoing + counts.complete === 0
              ? t.dashboard.empty
              : filter === 'ongoing'
                ? t.dashboard.nothingOngoing
                : t.dashboard.nothingComplete}
        </Empty>
      )}

      {/* Keyed by list so switching In progress/Complete fades the new one in. */}
      <ul key={filter} className="animate-list-in flex flex-col gap-1.5">
        {!hasLoaded &&
          isLoading &&
          SKELETON_ROWS.map((row) => (
            <li key={row}>
              <Skeleton className="h-15 w-full rounded-lg" />
            </li>
          ))}
        {shownGames.map((game) => (
          <GameRow key={game.appid} game={game} onPick={handlePickGame} />
        ))}
      </ul>

      {matchesInOtherList > 0 && (
        <Button
          variant="link"
          className="mx-auto mt-3 flex"
          onClick={() => setFilter(otherFilter)}
        >
          {t.dashboard.inOtherList[otherFilter](matchesInOtherList)}
        </Button>
      )}
    </section>
  );
}
