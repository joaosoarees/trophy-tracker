import { EyeOff, ListChecks, Pin, StickyNote, Trophy } from 'lucide-react';
import { memo } from 'react';

import { useLocale } from '@app/hooks/useLocale';
import { useT } from '@app/hooks/useT';
import { type IAchievement } from '@shared/types/Achievement';
import { type IAchievementUserData } from '@shared/types/UserData';
import { Hint } from '@ui/components/Hint';
import { IconButton } from '@ui/components/IconButton';
import { ProgressBar } from '@ui/components/ProgressBar';
import { RemoteImage } from '@ui/components/RemoteImage';
import { Badge } from '@ui/primitives/badge';
import { Button } from '@ui/primitives/button';
import { Textarea } from '@ui/primitives/textarea';
import { cn } from '@ui/utils/cn';
import { formatDate, formatNumber, formatPercent } from '@ui/utils/format';
import { TOGGLE_ON } from '@ui/utils/toggle';

import { Checklist } from '../Checklist';

import { GuideLinks } from './GuideLinks';
import { useAchievementCardController } from './useAchievementCardController';

interface IAchievementCardProps {
  achievement: IAchievement;
  game: string;
  appid: number;
  data: IAchievementUserData | undefined;
  onChange: (id: string, patch: Partial<IAchievementUserData>) => void;
}

// Memoised: a game has dozens of cards and most do not change between renders.
export const AchievementCard = memo(function AchievementCard(
  props: IAchievementCardProps,
) {
  const { achievement } = props;
  const t = useT();
  const locale = useLocale();
  const {
    checklist,
    checkedCount,
    note,
    isPinned,
    isChecklistOpen,
    isNoteVisible,
    shouldFocusNote,
    progress,
    handleOpenGuide,
    handleToggleChecklist,
    handleOpenNote,
    handleCloseNote,
    handleTogglePin,
    handleNoteChange,
    handleChecklistChange,
  } = useAchievementCardController(props);

  return (
    <li
      className={cn(
        'bg-card flex gap-3 rounded-lg border p-3 transition-colors',
        isPinned && 'border-warning/60',
        achievement.unlocked && 'opacity-90',
      )}
    >
      <RemoteImage
        src={
          achievement.unlocked
            ? achievement.icon
            : achievement.iconGray || achievement.icon
        }
        fallback={<Trophy className="size-5" />}
        className="size-12 flex-none"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 leading-snug font-semibold">
            {achievement.name}
          </h2>
          {achievement.hidden && (
            <Badge
              variant="outline"
              className="text-warning border-warning/40 gap-1 px-1.5 py-0 text-[10px]"
            >
              <EyeOff className="size-3" />
              {t.card.hidden}
            </Badge>
          )}
          {achievement.rarity !== null && (
            <Hint label={t.card.rarityTitle}>
              <span className="text-muted-foreground pt-0.5 text-xs tabular-nums">
                <span className="sr-only">{t.card.rarityTitle}: </span>
                {formatPercent(achievement.rarity, locale)}
              </span>
            </Hint>
          )}
        </div>
        <p className="text-foreground/75 mt-0.5 select-text">
          {achievement.description || t.card.noDescription}
        </p>

        {progress && (
          <div className="mt-2 flex items-center gap-2.5">
            <ProgressBar
              value={(progress.current / progress.target) * 100}
              className="flex-1"
            />
            {/* Says whose count this is: Steam's, or the user's own checklist. */}
            <Hint
              label={
                progress.source === 'checklist'
                  ? t.card.checklistCounter
                  : t.card.steamCounter
              }
            >
              <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
                {progress.source === 'checklist' && (
                  <ListChecks className="size-3" />
                )}
                <span className="sr-only">
                  {progress.source === 'checklist'
                    ? t.card.checklistCounter
                    : t.card.steamCounter}
                  :{' '}
                </span>
                {formatNumber(progress.current, locale)} /{' '}
                {formatNumber(progress.target, locale)}
              </span>
            </Hint>
          </div>
        )}

        {achievement.unlocked ? (
          achievement.unlockedAt && (
            <p className="text-muted-foreground mt-1.5 text-xs">
              {t.card.unlockedOn(formatDate(achievement.unlockedAt, locale))}
            </p>
          )
        ) : (
          <div className="mt-2.5 flex flex-wrap items-center gap-1">
            <GuideLinks onOpen={handleOpenGuide} />
            <span className="flex-1" />
            <Hint label={t.card.listTitle}>
              <Button
                size="xs"
                variant="ghost"
                className={cn(isChecklistOpen && TOGGLE_ON)}
                aria-expanded={isChecklistOpen}
                onClick={handleToggleChecklist}
              >
                <ListChecks />
                {checklist.length > 0
                  ? `${checkedCount}/${checklist.length}`
                  : t.card.list}
              </Button>
            </Hint>
            {!isNoteVisible && (
              <IconButton
                size="icon-xs"
                label={t.card.note}
                onClick={handleOpenNote}
              >
                <StickyNote />
              </IconButton>
            )}
            <IconButton
              size="icon-xs"
              label={isPinned ? t.card.unpin : t.card.pin}
              aria-pressed={isPinned}
              className={cn(isPinned && 'text-warning hover:text-warning')}
              onClick={handleTogglePin}
            >
              <Pin className={cn(isPinned && 'fill-current')} />
            </IconButton>
          </div>
        )}

        {isChecklistOpen && !achievement.unlocked && (
          <div className="expand-in">
            <Checklist
              achievement={achievement.name}
              items={checklist}
              onChange={handleChecklistChange}
            />
          </div>
        )}

        {isNoteVisible && (
          <div className="expand-in">
            <Textarea
              value={note}
              rows={2}
              autoFocus={shouldFocusNote}
              placeholder={t.card.notePlaceholder}
              className="mt-2.5 min-h-0 text-sm"
              onChange={(event) => handleNoteChange(event.target.value)}
              onBlur={handleCloseNote}
            />
          </div>
        )}
      </div>
    </li>
  );
});
