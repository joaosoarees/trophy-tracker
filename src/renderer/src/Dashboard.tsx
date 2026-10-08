import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { Empty, ProgressBar, SearchBox } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';
import { matches } from '@/lib/text';
import { cn } from '@/lib/utils';

interface Props {
  onPick(appid: number): void;
}

export function Dashboard({ onPick }: Props) {
  const t = useT();
  const { games, loading, error, progress, load } = useStore(
    useShallow((state) => ({
      games: state.dashboard.games,
      loading: state.dashboard.loading,
      error: state.dashboard.error,
      progress: state.dashboard.progress,
      load: state.dashboard.load,
    })),
  );
  const [query, setQuery] = useState('');

  const incomplete = games?.filter((g) => g.unlocked < g.total).length ?? 0;
  const shown = games?.filter((g) => matches(query, g.name)) ?? [];

  return (
    <section className="flex-1 overflow-y-auto p-4">
      <header className="mb-3">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-xl font-semibold">{t.dashboard.title}</h1>
          <Button
            size="icon-sm"
            variant="ghost"
            title={t.dashboard.refreshAll}
            disabled={loading}
            onClick={() => void load('all')}
          >
            <RefreshCw className={cn(loading && 'animate-spin')} />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {loading
            ? progress
              ? t.dashboard.reading(progress[0], progress[1])
              : t.dashboard.loadingLibrary
            : games &&
              t.dashboard.summary(
                games.length,
                games.length - incomplete,
                incomplete,
              )}
        </p>
        {error && <p className="text-destructive mt-1">{error}</p>}
      </header>

      {games && games.length > 0 && (
        <div className="mb-3 flex">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={t.dashboard.search}
          />
        </div>
      )}

      {games && !loading && shown.length === 0 && (
        <Empty>
          {query.trim() !== ''
            ? t.dashboard.nothingFound(query.trim())
            : t.dashboard.empty}
        </Empty>
      )}

      <ul className="flex flex-col gap-1.5">
        {shown.map((g) => {
          const percent = Math.round((g.unlocked / g.total) * 100);
          const complete = g.unlocked === g.total;
          return (
            <li key={g.appid}>
              <button
                onClick={() => onPick(g.appid)}
                className="bg-card hover:border-primary/60 flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors"
              >
                {g.capsule || g.icon ? (
                  <img
                    src={g.capsule || g.icon}
                    alt=""
                    loading="lazy"
                    className={cn(
                      'bg-muted h-[42px] flex-none rounded object-cover',
                      g.capsule ? 'w-28' : 'w-[42px]',
                    )}
                  />
                ) : (
                  <span className="bg-muted h-[42px] w-28 flex-none rounded" />
                )}
                <div className="min-w-0 flex-1">
                  <strong className="block truncate font-medium">
                    {g.name}
                  </strong>
                  <ProgressBar
                    value={percent}
                    tone={complete ? 'success' : 'primary'}
                    className="mt-1.5"
                  />
                </div>
                <div className="w-[72px] flex-none text-right">
                  <strong
                    className={cn(
                      'block tabular-nums',
                      complete && 'text-success',
                    )}
                  >
                    {percent}%
                  </strong>
                  <small className="text-muted-foreground text-[11px]">
                    {complete
                      ? t.dashboard.complete
                      : t.dashboard.left(g.total - g.unlocked)}
                  </small>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
