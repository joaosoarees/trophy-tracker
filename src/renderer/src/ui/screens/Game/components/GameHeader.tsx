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
        className="absolute inset-0 size-full rounded-none opacity-35 blur-[2px]"
      />
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
          <IconButton
            label={t.common.refresh}
            disabled={isLoading}
            onClick={onRefresh}
          >
            <RefreshCw className={cn(isLoading && 'animate-spin')} />
          </IconButton>
        </div>

        <ProgressBar
          value={percent}
          tone={isComplete ? 'success' : 'primary'}
          className="mt-2.5 h-2"
        />
        <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
          <Trophy className="size-3.5" />
          {t.game.summary(view.unlockedCount, view.total, percent)}
          {pending > 0
            ? ` · ${t.game.left(pending)}`
            : isComplete
              ? ` · ${t.game.allUnlocked}`
              : ''}
        </p>
        {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
      </div>
    </header>
  );
}
