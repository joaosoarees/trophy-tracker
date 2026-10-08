import { RefreshCw, Trophy } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type IGameView } from '@shared/types/Game';
import { IconButton } from '@ui/components/IconButton';
import { ProgressBar } from '@ui/components/ProgressBar';
import { RemoteImage } from '@ui/components/RemoteImage';
import { cn } from '@ui/utils/cn';

interface IGameHeaderProps {
  view: IGameView;
  running: boolean;
  pending: number;
  percent: number;
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function GameHeader({
  view,
  running,
  pending,
  percent,
  isComplete,
  isLoading,
  error,
  onRefresh,
}: IGameHeaderProps) {
  const t = useT();

  return (
    <header className="relative overflow-hidden border-b">
      {/* Decorative: if the art fails, the header simply has no background. */}
      <RemoteImage
        src={view.header}
        fallback={null}
        showSkeleton={false}
        // A finished game shows its art clearly; until then it stays back.
        className={cn(
          'absolute inset-0 size-full rounded-none',
          isComplete ? 'opacity-60' : 'opacity-35 blur-[2px]',
        )}
      />
      <div className="from-background via-background/80 absolute inset-0 bg-linear-to-t to-transparent" />

      <div className="relative px-4 pt-10 pb-3.5">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">
            {view.name}
          </h1>
          {running && (
            <span className="text-success flex items-center gap-1.5 text-xs font-medium">
              <span className="bg-success size-1.5 animate-pulse rounded-full" />
              {t.game.running}
            </span>
          )}
          <IconButton
            label={t.common.refresh}
            disabled={isLoading}
            onClick={onRefresh}
          >
            <RefreshCw className={cn(isLoading && 'animate-spin')} />
          </IconButton>
        </div>

        {/* What is left is the number looked for at a glance, so it is the
            one figure that stands out; the full count sits below it. */}
        <div className="mt-2.5 flex items-center gap-3">
          <ProgressBar
            label={view.name}
            value={percent}
            tone={isComplete ? 'success' : 'primary'}
            className="h-2 flex-1"
          />
          {pending > 0 && (
            <strong className="flex-none font-semibold tabular-nums">
              {t.game.left(pending)}
            </strong>
          )}
          {isComplete && (
            <strong className="text-success flex-none font-semibold">
              {t.game.allUnlocked}
            </strong>
          )}
        </div>
        <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs tabular-nums">
          <Trophy className="size-3.5" />
          {t.game.summary(view.unlockedCount, view.total, percent)}
        </p>
        {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
      </div>
    </header>
  );
}
