import { EyeOff, ListChecks, Pin, StickyNote } from 'lucide-react';
import { memo } from 'react';

import { useLocale } from '@app/hooks/useLocale';
import { useT } from '@app/hooks/useT';
import { type IAchievement, type IAchievementUserData } from '@shared/types';
import { ProgressBar } from '@ui/components/ProgressBar';
import { Badge } from '@ui/primitives/badge';
import { Button } from '@ui/primitives/button';
import { Textarea } from '@ui/primitives/textarea';
import { cn } from '@ui/utils/cn';
import { formatDate, formatNumber, formatPercent } from '@ui/utils/format';

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
      <img
        src={
          achievement.unlocked
            ? achievement.icon
            : achievement.iconGray || achievement.icon
        }
        alt=""
        loading="lazy"
        className="bg-muted size-12 flex-none rounded-md"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 leading-snug font-semibold">
            {achievement.name}
          </h3>
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
            <span
              className="text-muted-foreground pt-0.5 text-xs tabular-nums"
              title={t.card.rarityTitle}
            >
              {formatPercent(achievement.rarity, locale)}
            </span>
          )}
        </div>
        <p className="text-foreground/75 mt-0.5 select-text">
          {achievement.description || t.card.noDescription}
        </p>

        {progress && (
          <div
            className="mt-2 flex items-center gap-2.5"
            title={
              progress.source === 'checklist'
                ? t.card.checklistCounter
                : t.card.steamCounter
            }
          >
            <ProgressBar
              value={(progress.current / progress.target) * 100}
              className="flex-1"
            />
            <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
              {progress.source === 'checklist' && (
                <ListChecks className="size-3" />
              )}
              {formatNumber(progress.current, locale)} /{' '}
              {formatNumber(progress.target, locale)}
            </span>
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
            <Button
              size="xs"
              variant={isChecklistOpen ? 'default' : 'ghost'}
              title={t.card.listTitle}
              onClick={handleToggleChecklist}
            >
              <ListChecks />
              {checklist.length > 0
                ? `${checkedCount}/${checklist.length}`
                : t.card.list}
            </Button>
            {!isNoteVisible && (
              <Button
                size="icon-xs"
                variant="ghost"
                title={t.card.note}
                onClick={handleOpenNote}
              >
                <StickyNote />
              </Button>
            )}
            <Button
              size="icon-xs"
              variant="ghost"
              title={isPinned ? t.card.unpin : t.card.pin}
              className={cn(isPinned && 'text-warning hover:text-warning')}
              onClick={handleTogglePin}
            >
              <Pin className={cn(isPinned && 'fill-current')} />
            </Button>
          </div>
        )}

        {isChecklistOpen && !achievement.unlocked && (
          <Checklist
            achievement={achievement.name}
            items={checklist}
            onChange={handleChecklistChange}
          />
        )}

        {isNoteVisible && (
          <Textarea
            value={note}
            rows={2}
            autoFocus={shouldFocusNote}
            placeholder={t.card.notePlaceholder}
            className="mt-2.5 min-h-0 text-sm"
            onChange={(event) => handleNoteChange(event.target.value)}
            onBlur={handleCloseNote}
          />
        )}
      </div>
    </li>
  );
});
