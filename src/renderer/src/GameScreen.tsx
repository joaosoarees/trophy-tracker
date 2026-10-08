import { RefreshCw, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { shownProgress } from '../../shared/checklist';
import type {
  Achievement,
  AchievementUserData,
  GameUserData,
} from '../../shared/types';
import { useStore } from '@/store';
import { AchievementCard } from '@/components/AchievementCard';
import { Empty, ProgressBar, SearchBox, Segmented } from '@/components/bits';
import { Button } from '@/components/ui/button';
import { useLocale, useT } from '@/lib/i18n';
import { matches } from '@/lib/text';
import { cn } from '@/lib/utils';

type Sort = 'common' | 'rare' | 'closest' | 'name';
type Filter = 'pending' | 'unlocked';

const SORTS: Sort[] = ['common', 'rare', 'closest', 'name'];

const NONE_UNLOCKED: string[] = [];
const NO_USER_DATA: GameUserData = {};

interface Props {
  appid: number;
  running: boolean;
}

export function GameScreen({ appid, running }: Props) {
  const t = useT();
  const locale = useLocale();
  const {
    view,
    loading,
    error,
    justUnlocked,
    userData,
    open,
    load,
    updateUserData,
    dismissUnlocked,
  } = useStore(
    useShallow((state) => {
      const entry = state.games.entries[appid];
      return {
        view: entry?.view ?? null,
        loading: entry?.loading ?? true,
        error: entry?.error ?? null,
        justUnlocked: entry?.justUnlocked ?? NONE_UNLOCKED,
        userData: state.userData.byGame[appid] ?? NO_USER_DATA,
        open: state.games.open,
        load: state.games.load,
        updateUserData: state.userData.update,
        dismissUnlocked: state.games.dismissUnlocked,
      };
    }),
  );
  const [filter, setFilter] = useState<Filter>('pending');
  const [sort, setSort] = useState<Sort>('common');
  const [query, setQuery] = useState('');

  useEffect(() => open(appid), [open, appid]);

  const update = useCallback(
    (id: string, patch: Partial<AchievementUserData>) =>
      updateUserData(appid, id, patch),
    [updateUserData, appid],
  );

  const list = useMemo(() => {
    if (!view) return [];
    const ratio = (a: Achievement): number => {
      const p = shownProgress(a, userData[a.id]);
      return p ? p.current / p.target : -1;
    };
    const by: Record<Sort, (a: Achievement, b: Achievement) => number> = {
      common: (a, b) => (b.rarity ?? -1) - (a.rarity ?? -1),
      rare: (a, b) => (a.rarity ?? 101) - (b.rarity ?? 101),
      closest: (a, b) =>
        ratio(b) - ratio(a) || (b.rarity ?? -1) - (a.rarity ?? -1),
      name: (a, b) => a.name.localeCompare(b.name, locale),
    };
    const order =
      filter === 'unlocked'
        ? (a: Achievement, b: Achievement) =>
            (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0)
        : by[sort];
    const pinned = (a: Achievement): number => (userData[a.id]?.pinned ? 1 : 0);
    return view.achievements
      .filter(
        (a) =>
          a.unlocked === (filter === 'unlocked') &&
          matches(query, a.name, a.description),
      )
      .sort((a, b) => pinned(b) - pinned(a) || order(a, b));
  }, [view, filter, sort, query, userData, locale]);

  if (!view) {
    return (
      <Empty>
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <Button variant="secondary" onClick={() => void load(appid, true)}>
              {t.common.retry}
            </Button>
          </>
        ) : (
          <p>{t.game.loading}</p>
        )}
      </Empty>
    );
  }

  const pending = view.total - view.unlockedCount;
  const percent =
    view.total === 0 ? 0 : Math.round((view.unlockedCount / view.total) * 100);
  const complete = view.total > 0 && pending === 0;

  return (
    <section className="flex-1 overflow-y-auto">
      <header className="relative overflow-hidden border-b">
        {view.header && (
          <img
            src={view.header}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-35 blur-[2px]"
          />
        )}
        <div className="from-background via-background/80 absolute inset-0 bg-gradient-to-t to-transparent" />
        <div className="relative px-4 pt-10 pb-3.5">
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 flex-1 truncate text-xl font-semibold drop-shadow">
              {view.name}
            </h1>
            {running && (
              <span className="text-success flex items-center gap-1.5 text-xs font-medium">
                <span className="bg-success size-1.5 animate-pulse rounded-full" />
                {t.game.running}
              </span>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              title={t.common.refresh}
              disabled={loading}
              onClick={() => void load(appid, true)}
            >
              <RefreshCw className={cn(loading && 'animate-spin')} />
            </Button>
          </div>
          <ProgressBar
            value={percent}
            tone={complete ? 'success' : 'primary'}
            className="mt-2.5 h-2"
          />
          <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
            <Trophy className="size-3.5" />
            {t.game.summary(view.unlockedCount, view.total, percent)}
            {pending > 0
              ? ` · ${t.game.left(pending)}`
              : complete
                ? ` · ${t.game.allUnlocked}`
                : ''}
          </p>
          {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
        </div>
      </header>

      {justUnlocked.length > 0 && (
        <button
          onClick={() => dismissUnlocked(appid)}
          className="bg-success/15 text-success mx-4 mt-3 block w-[calc(100%-2rem)] rounded-md px-3 py-2 text-left"
        >
          {t.game.justUnlocked(justUnlocked.join(', '))}
        </button>
      )}

      {view.total === 0 ? (
        <Empty>{t.game.noAchievements}</Empty>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'pending', label: t.game.pending(pending) },
                {
                  value: 'unlocked',
                  label: t.game.unlocked(view.unlockedCount),
                },
              ]}
            />
            <span className="flex-1" />
            {filter === 'pending' && (
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="bg-muted text-foreground h-8 rounded-md border px-2 text-xs"
              >
                {SORTS.map((value) => (
                  <option key={value} value={value}>
                    {t.game.sort[value]}
                  </option>
                ))}
              </select>
            )}
            <div className="flex basis-full">
              <SearchBox
                value={query}
                onChange={setQuery}
                placeholder={t.game.search}
              />
            </div>
          </div>

          {list.length === 0 && (
            <Empty>
              {query.trim() !== ''
                ? t.game.nothingFound(query.trim())
                : filter === 'pending'
                  ? t.game.nothingPending
                  : t.game.nothingUnlocked}
            </Empty>
          )}

          <ul className="flex flex-col gap-2">
            {list.map((a) => (
              <AchievementCard
                key={a.id}
                a={a}
                game={view.name}
                appid={appid}
                data={userData[a.id]}
                onChange={update}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
