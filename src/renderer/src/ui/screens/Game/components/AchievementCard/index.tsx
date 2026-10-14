import {
  ExternalLink,
  EyeOff,
  Link2,
  ListChecks,
  Pin,
  StickyNote,
  Trophy,
} from 'lucide-react';
import { memo } from 'react';

import { useLocale } from '@app/hooks/useLocale';
import { useT } from '@app/hooks/useT';
import { linkHost } from '@shared/link';
import { type IAchievement } from '@shared/types/Achievement';
import { type IAchievementUserData } from '@shared/types/UserData';
import { Collapsible } from '@ui/components/Collapsible';
import { Hint } from '@ui/components/Hint';
import { IconButton } from '@ui/components/IconButton';
import { ProgressBar } from '@ui/components/ProgressBar';
import { RemoteImage } from '@ui/components/RemoteImage';
import { Badge } from '@ui/primitives/badge';
import { Button } from '@ui/primitives/button';
import { Input } from '@ui/primitives/input';
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
  const { achievement, appid } = props;
  const t = useT();
  const locale = useLocale();
  const {
    checklist,
    checkedCount,
    note,
    isPinned,
    link,
    linkText,
    isLinkOpen,
    isLinkInvalid,
    isChecklistOpen,
    isNoteVisible,
    shouldFocusNote,
    progress,
    handleOpenGuide,
    handleOpenLink,
    handleToggleLink,
    handleLinkChange,
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
              label={achievement.name}
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
          // Two groups, so that a row too long for a narrow window breaks
          // between the searches and the user's tools, never inside either.
          <div className="mt-2.5 flex flex-wrap items-center gap-1">
            <div className="flex min-w-0 items-center gap-1">
              {link && (
                <Hint label={t.card.linkOpen}>
                  <Button
                    size="xs"
                    variant="ghost"
                    // The one page the user chose, among searches: in the accent.
                    className="text-primary hover:text-primary max-w-40 min-w-0 shrink"
                    onClick={handleOpenLink}
                  >
                    <ExternalLink />
                    <span className="truncate">{linkHost(link)}</span>
                  </Button>
                </Hint>
              )}
              <GuideLinks onOpen={handleOpenGuide} />
            </div>
            <div className="ml-auto flex items-center">
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
              <IconButton
                size="icon-xs"
                label={link ? t.card.linkChange : t.card.link}
                className={cn(isLinkOpen && TOGGLE_ON)}
                aria-expanded={isLinkOpen}
                onClick={handleToggleLink}
              >
                <Link2 />
              </IconButton>
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
          </div>
        )}

        <Collapsible open={isChecklistOpen && !achievement.unlocked}>
          <Checklist
            appid={appid}
            achievementId={achievement.id}
            achievement={achievement.name}
            items={checklist}
            onChange={handleChecklistChange}
          />
        </Collapsible>

        <Collapsible open={isLinkOpen && !achievement.unlocked}>
          <div className="mt-2.5 space-y-1.5">
            <Input
              value={linkText}
              inputMode="url"
              autoFocus
              aria-label={t.card.linkPlaceholder}
              aria-invalid={isLinkInvalid}
              placeholder={t.card.linkPlaceholder}
              className="h-7 text-sm"
              onChange={(event) => handleLinkChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') {
                  handleToggleLink();
                }
              }}
            />
            {isLinkInvalid && (
              <p className="text-destructive text-xs">{t.card.linkInvalid}</p>
            )}
          </div>
        </Collapsible>

        <Collapsible open={isNoteVisible}>
          <Textarea
            value={note}
            rows={2}
            autoFocus={shouldFocusNote}
            placeholder={t.card.notePlaceholder}
            className="mt-2.5 min-h-0 text-sm"
            onChange={(event) => handleNoteChange(event.target.value)}
            // A saved note is shown without having been opened: it is open
            // from the moment it is edited, or deleting its text would take
            // the field from under the cursor.
            onFocus={handleOpenNote}
            onBlur={handleCloseNote}
          />
        </Collapsible>
      </div>
    </li>
  );
});
