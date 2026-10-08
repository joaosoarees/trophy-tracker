import { useT } from '@app/hooks/useT';
import { Empty } from '@ui/components/Empty';
import { Button } from '@ui/primitives/button';

import { AchievementCard } from './components/AchievementCard';
import { AchievementToolbar } from './components/AchievementToolbar';
import { GameHeader } from './components/GameHeader';
import { GameSkeleton } from './components/GameSkeleton';
import { useGameController } from './useGameController';

interface IGameProps {
  appid: number;
  running: boolean;
}

export function Game({ appid, running }: IGameProps) {
  const t = useT();
  const {
    view,
    isLoading,
    error,
    justUnlocked,
    userData,
    achievements,
    pending,
    percent,
    isComplete,
    filter,
    sort,
    query,
    setFilter,
    setQuery,
    handleSortChange,
    handleUserDataChange,
    handleRefresh,
    handleDismissUnlocked,
  } = useGameController(appid);

  if (!view) {
    if (!error) {
      return <GameSkeleton />;
    }

    return (
      <Empty>
        <p className="text-destructive">{error}</p>
        <Button variant="secondary" onClick={handleRefresh}>
          {t.common.retry}
        </Button>
      </Empty>
    );
  }

  return (
    <section className="flex-1 overflow-y-auto">
      <GameHeader
        view={view}
        running={running}
        pending={pending}
        percent={percent}
        isComplete={isComplete}
        isLoading={isLoading}
        error={error}
        onRefresh={handleRefresh}
      />

      {justUnlocked.length > 0 && (
        <button
          onClick={handleDismissUnlocked}
          className="bg-success/15 text-success mx-4 mt-3 block w-[calc(100%-2rem)] rounded-md px-3 py-2 text-left"
        >
          {t.game.justUnlocked(justUnlocked.join(', '))}
        </button>
      )}

      {view.total === 0 ? (
        <Empty>{t.game.noAchievements}</Empty>
      ) : (
        <div className="p-4">
          <AchievementToolbar
            filter={filter}
            sort={sort}
            query={query}
            pending={pending}
            unlocked={view.unlockedCount}
            onFilterChange={setFilter}
            onSortChange={handleSortChange}
            onQueryChange={setQuery}
          />

          {achievements.length === 0 && (
            <Empty>
              {query.trim() !== ''
                ? t.game.nothingFound(query.trim())
                : filter === 'pending'
                  ? t.game.nothingPending
                  : t.game.nothingUnlocked}
            </Empty>
          )}

          <ul className="flex flex-col gap-2">
            {achievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                game={view.name}
                appid={appid}
                data={userData[achievement.id]}
                onChange={handleUserDataChange}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
