import { X } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { Collapsible } from '@ui/components/Collapsible';
import { Empty } from '@ui/components/Empty';
import { IconButton } from '@ui/components/IconButton';
import { Button } from '@ui/primitives/button';

import { AchievementCard } from './components/AchievementCard';
import { AchievementToolbar } from './components/AchievementToolbar';
import { GameComplete } from './components/GameComplete';
import { GameDetails } from './components/GameDetails';
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
    completion,
    details,
    isDetailsOpen,
    playtimeMinutes,
    lastPlayed,
    handleToggleDetails,
    handleFindAchievement,
    otherFilter,
    matchesInOtherList,
    filter,
    sort,
    query,
    hiddenOnly,
    hiddenCount,
    handleToggleHiddenOnly,
    setFilter,
    setQuery,
    handleClearSearch,
    handleShowOtherList,
    handleShowUnlocked,
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

  const otherListLink = matchesInOtherList > 0 && (
    <Button
      variant="link"
      className="mx-auto flex"
      onClick={handleShowOtherList}
    >
      {t.game.inOtherList[otherFilter](matchesInOtherList)}
    </Button>
  );

  return (
    // `relative`: the scrolling box must contain what is positioned inside it.
    // Visually hidden text is absolutely positioned; without this it sits in
    // the document instead, far below the window, and the window itself
    // gets a second scrollbar.
    <section className="relative flex-1 overflow-y-auto">
      <GameHeader
        view={view}
        running={running}
        pending={pending}
        percent={percent}
        isComplete={isComplete}
        isLoading={isLoading}
        error={error}
        onRefresh={handleRefresh}
        isDetailsOpen={isDetailsOpen}
        onToggleDetails={handleToggleDetails}
      >
        <Collapsible open={isDetailsOpen && details !== null}>
          {details && (
            <GameDetails
              details={details}
              playtimeMinutes={playtimeMinutes}
              lastPlayed={lastPlayed}
              onFind={handleFindAchievement}
            />
          )}
        </Collapsible>
      </GameHeader>

      {justUnlocked.length > 0 && (
        <div
          role="status"
          className="bg-success/15 text-success mx-4 mt-3 flex items-center gap-2 rounded-md py-1 pr-1 pl-3"
        >
          <p className="min-w-0 flex-1 py-1">
            {isComplete
              ? t.game.justCompleted
              : t.game.justUnlocked(justUnlocked.join(', '))}
          </p>
          <IconButton
            label={t.common.dismiss}
            className="hover:bg-success/20 hover:text-success dark:hover:bg-success/20 flex-none"
            onClick={handleDismissUnlocked}
          >
            <X />
          </IconButton>
        </div>
      )}

      {view.total === 0 ? (
        <Empty>{t.game.noAchievements}</Empty>
      ) : completion && filter === 'pending' ? (
        // Nothing is pending: the list and its filters give way to the result.
        <GameComplete
          completion={completion}
          onSeeUnlocked={handleShowUnlocked}
        />
      ) : (
        <div className="p-4">
          <AchievementToolbar
            filter={filter}
            sort={sort}
            query={query}
            pending={pending}
            unlocked={view.unlockedCount}
            hiddenOnly={hiddenOnly}
            hiddenCount={hiddenCount}
            onFilterChange={setFilter}
            onHiddenOnlyToggle={handleToggleHiddenOnly}
            onSortChange={handleSortChange}
            onQueryChange={setQuery}
          />

          {achievements.length === 0 && (
            <Empty>
              {query.trim() !== ''
                ? t.game.nothingFound(query.trim())
                : t.game.nothingUnlocked}
              {/* Where the matches are comes first: it is the likelier next step. */}
              {otherListLink}
              {query.trim() !== '' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClearSearch}
                >
                  {t.common.clearSearch}
                </Button>
              )}
            </Empty>
          )}

          {/* Keyed by list so switching Pending/Unlocked fades the new one in. */}
          <ul key={filter} className="animate-list-in flex flex-col gap-2">
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

          {achievements.length > 0 && otherListLink && (
            <div className="mt-3">{otherListLink}</div>
          )}
        </div>
      )}
    </section>
  );
}
