import { RefreshCw } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { Empty } from '@ui/components/Empty';
import { SearchBox } from '@ui/components/SearchBox';
import { Button } from '@ui/primitives/button';
import { cn } from '@ui/utils/cn';

import { GameRow } from './components/GameRow';
import { useDashboardController } from './useDashboardController';

export function Dashboard() {
  const t = useT();
  const {
    games,
    shownGames,
    total,
    inProgress,
    complete,
    isLoading,
    error,
    progress,
    query,
    setQuery,
    handleRefreshAll,
    handlePickGame,
  } = useDashboardController();

  return (
    <section className="flex-1 overflow-y-auto p-4">
      <header className="mb-3">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-xl font-semibold">{t.dashboard.title}</h1>
          <Button
            size="icon-sm"
            variant="ghost"
            title={t.dashboard.refreshAll}
            disabled={isLoading}
            onClick={handleRefreshAll}
          >
            <RefreshCw className={cn(isLoading && 'animate-spin')} />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {isLoading
            ? progress
              ? t.dashboard.reading(progress[0], progress[1])
              : t.dashboard.loadingLibrary
            : games && t.dashboard.summary(total, complete, inProgress)}
        </p>
        {error && <p className="text-destructive mt-1">{error}</p>}
      </header>

      {total > 0 && (
        <div className="mb-3 flex">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={t.dashboard.search}
          />
        </div>
      )}

      {games && !isLoading && shownGames.length === 0 && (
        <Empty>
          {query.trim() !== ''
            ? t.dashboard.nothingFound(query.trim())
            : t.dashboard.empty}
        </Empty>
      )}

      <ul className="flex flex-col gap-1.5">
        {shownGames.map((game) => (
          <GameRow key={game.appid} game={game} onPick={handlePickGame} />
        ))}
      </ul>
    </section>
  );
}
