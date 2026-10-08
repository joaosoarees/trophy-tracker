import { Gamepad2 } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type IGameSummary } from '@shared/types/Game';
import { ProgressBar } from '@ui/components/ProgressBar';
import { RemoteImage } from '@ui/components/RemoteImage';
import { cn } from '@ui/utils/cn';

interface IGameRowProps {
  game: IGameSummary;
  onPick: (appid: number) => void;
}

export function GameRow({ game, onPick }: IGameRowProps) {
  const t = useT();
  const percent = Math.round((game.unlocked / game.total) * 100);
  const isComplete = game.unlocked === game.total;
  const art = game.capsule || game.icon;

  return (
    <li>
      <button
        onClick={() => onPick(game.appid)}
        className="bg-card hover:border-primary/60 flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors"
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
          <ProgressBar
            value={percent}
            tone={isComplete ? 'success' : 'primary'}
            className="mt-1.5"
          />
        </div>

        <div className="w-[72px] flex-none text-right">
          <strong
            className={cn('block tabular-nums', isComplete && 'text-success')}
          >
            {percent}%
          </strong>
          <small className="text-muted-foreground text-[11px]">
            {isComplete
              ? t.dashboard.complete
              : t.dashboard.left(game.total - game.unlocked)}
          </small>
        </div>
      </button>
    </li>
  );
}
