import {
  BookOpen,
  CirclePlay,
  EyeOff,
  ListChecks,
  Pin,
  Search,
  StickyNote,
} from 'lucide-react';
import { memo, useState, type ReactNode } from 'react';

import { useLocale } from '@app/hooks/useLocale';
import { useT } from '@app/hooks/useT';
import { shownProgress } from '@shared/checklist';
import type {
  IAchievement,
  IAchievementUserData,
  GuideSite,
} from '@shared/types';
import { ProgressBar } from '@ui/components/bits';
import { Badge } from '@ui/primitives/badge';
import { Button } from '@ui/primitives/button';
import { Textarea } from '@ui/primitives/textarea';
import { Checklist } from '@ui/screens/Game/components/Checklist';
import { cn } from '@ui/utils/cn';

const GUIDES: { site: GuideSite; icon: ReactNode }[] = [
  { site: 'steam', icon: <BookOpen /> },
  { site: 'youtube', icon: <CirclePlay /> },
  { site: 'google', icon: <Search /> },
];
const SITE_NAMES = { youtube: 'YouTube', google: 'Google' };

interface IProps {
  a: IAchievement;
  game: string;
  appid: number;
  data: IAchievementUserData | undefined;
  onChange: (id: string, patch: Partial<IAchievementUserData>) => void;
}

export const AchievementCard = memo(function AchievementCard({
  a,
  game,
  appid,
  data,
  onChange,
}: IProps) {
  const t = useT();
  const locale = useLocale();
  const date = (epoch: number): string =>
    new Date(epoch * 1000).toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  const number = (n: number): string => n.toLocaleString(locale);
  const checklist = data?.checklist ?? [];
  const note = data?.note ?? '';
  const pinned = data?.pinned === true;
  const [noteOpen, setNoteOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const showNote = noteOpen || note !== '';
  const progress = a.unlocked ? null : shownProgress(a, data);
  const done = checklist.filter((i) => i.done).length;

  return (
    <li
      className={cn(
        'bg-card flex gap-3 rounded-lg border p-3 transition-colors',
        pinned && 'border-warning/60',
        a.unlocked && 'opacity-90',
      )}
    >
      <img
        src={a.unlocked ? a.icon : a.iconGray || a.icon}
        alt=""
        loading="lazy"
        className="bg-muted size-12 flex-none rounded-md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 leading-snug font-semibold">
            {a.name}
          </h3>
          {a.hidden && (
            <Badge
              variant="outline"
              className="text-warning border-warning/40 gap-1 px-1.5 py-0 text-[10px]"
            >
              <EyeOff className="size-3" />
              {t.card.hidden}
            </Badge>
          )}
          {a.rarity !== null && (
            <span
              className="text-muted-foreground pt-0.5 text-xs tabular-nums"
              title={t.card.rarityTitle}
            >
              {a.rarity.toLocaleString(locale, { maximumFractionDigits: 1 })}%
            </span>
          )}
        </div>
        <p className="text-foreground/75 mt-0.5 select-text">
          {a.description || t.card.noDescription}
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
              {number(progress.current)} / {number(progress.target)}
            </span>
          </div>
        )}

        {a.unlocked ? (
          a.unlockedAt && (
            <p className="text-muted-foreground mt-1.5 text-xs">
              {t.card.unlockedOn(date(a.unlockedAt))}
            </p>
          )
        ) : (
          <div className="mt-2.5 flex flex-wrap items-center gap-1">
            {GUIDES.map(({ site, icon }) => (
              <Button
                key={site}
                size="xs"
                variant="secondary"
                title={
                  site === 'steam'
                    ? t.guides.steamTitle
                    : t.guides.searchOn(SITE_NAMES[site])
                }
                onClick={() =>
                  void window.api.openGuide(site, appid, game, a.name)
                }
              >
                {icon}
                {site === 'steam' ? t.guides.steam : SITE_NAMES[site]}
              </Button>
            ))}
            <span className="flex-1" />
            <Button
              size="xs"
              variant={listOpen ? 'default' : 'ghost'}
              title={t.card.listTitle}
              onClick={() => setListOpen(!listOpen)}
            >
              <ListChecks />
              {checklist.length > 0
                ? `${done}/${checklist.length}`
                : t.card.list}
            </Button>
            {!showNote && (
              <Button
                size="icon-xs"
                variant="ghost"
                title={t.card.note}
                onClick={() => setNoteOpen(true)}
              >
                <StickyNote />
              </Button>
            )}
            <Button
              size="icon-xs"
              variant="ghost"
              title={pinned ? t.card.unpin : t.card.pin}
              className={cn(pinned && 'text-warning hover:text-warning')}
              onClick={() => onChange(a.id, { pinned: !pinned })}
            >
              <Pin className={cn(pinned && 'fill-current')} />
            </Button>
          </div>
        )}

        {listOpen && !a.unlocked && (
          <Checklist
            achievement={a.name}
            items={checklist}
            onChange={(items) => onChange(a.id, { checklist: items })}
          />
        )}

        {showNote && (
          <Textarea
            value={note}
            rows={2}
            autoFocus={noteOpen && note === ''}
            placeholder={t.card.notePlaceholder}
            className="mt-2.5 min-h-0 text-sm"
            onChange={(e) => onChange(a.id, { note: e.target.value })}
            onBlur={() => setNoteOpen(false)}
          />
        )}
      </div>
    </li>
  );
});
