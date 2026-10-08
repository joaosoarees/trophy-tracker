import { CircleCheck, Gamepad2 } from 'lucide-react';

import { useLocale } from '@app/hooks/useLocale';
import { useT } from '@app/hooks/useT';
import { type IGameSummary } from '@shared/types/Game';
import { Pressable } from '@ui/components/Pressable';
import { ProgressBar } from '@ui/components/ProgressBar';
import { RemoteImage } from '@ui/components/RemoteImage';
import { cn } from '@ui/utils/cn';
import { formatDate } from '@ui/utils/format';

interface IGameRowProps {
  game: IGameSummary;
  onPick: (appid: number) => void;
}

export function GameRow({ game, onPick }: IGameRowProps) {
  const t = useT();
  const locale = useLocale();
  const percent = Math.round((game.unlocked / game.total) * 100);
  const isComplete = game.unlocked === game.total;
  const art = game.capsule || game.icon;

  return (
    <li>
      <Pressable
        onClick={() => onPick(game.appid)}
        className="bg-card hover:border-primary/60 hover:bg-accent/40 active:bg-accent/70 flex w-full active:scale-[0.99] items-center gap-3 rounded-lg border p-2 text-left"
      >
        <RemoteImage
          src={art}
          fallback={<Gamepad2 className="size-5" />}
          className={cn(
            'h-[42px] flex-none rounded',
            // Without a capsule the small square icon is all there is.
            game.capsule || !game.icon ? 'w-28' : 'w-[42px]',
          )}
        />

        <div className="min-w-0 flex-1">
          <strong className="block truncate font-medium">{game.name}</strong>
          {isComplete ? (
            // A full bar says nothing new; the line under the name says when it was finished.
            <small className="text-muted-foreground mt-0.5 block truncate text-xs">
              {[
                // Just the date: the list is already the complete games.
                game.completedAt && formatDate(game.completedAt, locale),
                t.dashboard.achievementCount(game.total),
              ]
                .filter(Boolean)
                .join(' · ')}
            </small>
          ) : (
            <ProgressBar value={percent} className="mt-1.5" />
          )}
        </div>

        {isComplete ? (
          <strong className="text-success flex flex-none items-center gap-1 tabular-nums">
            <CircleCheck className="size-4" />
            100%
          </strong>
        ) : (
          <div className="w-[72px] flex-none text-right">
            <strong className="block tabular-nums">{percent}%</strong>
            <small className="text-muted-foreground text-[11px]">
              {t.dashboard.left(game.total - game.unlocked)}
            </small>
          </div>
        )}
      </Pressable>
    </li>
  );
}
