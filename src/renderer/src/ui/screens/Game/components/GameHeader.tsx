import { ChevronDown, RefreshCw, Trophy } from 'lucide-react';
import { type ReactNode } from 'react';

import { useT } from '@app/hooks/useT';
import { type IGameView } from '@shared/types/Game';
import { IconButton } from '@ui/components/IconButton';
import { ProgressBar } from '@ui/components/ProgressBar';
import { RemoteImage } from '@ui/components/RemoteImage';
import { Button } from '@ui/primitives/button';
import { cn } from '@ui/utils/cn';

interface IGameHeaderProps {
  view: IGameView;
  isRunning: boolean;
  pending: number;
  percent: number;
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  isDetailsOpen: boolean;
  onToggleDetails: () => void;
  /** The details, when they are open. */
  children?: ReactNode;
}

export function GameHeader({
  view,
  isRunning,
  pending,
  percent,
  isComplete,
  isLoading,
  error,
  onRefresh,
  isDetailsOpen,
  onToggleDetails,
  children,
}: IGameHeaderProps) {
  const t = useT();

  return (
    <header className="relative overflow-hidden border-b">
      {/* Decorative: if the art fails, the header simply has no background.
          The art keeps to a band behind the title: details that open below
          sit on the plain field, and the image is never rescaled. The band
          clips its content, or the blur would bleed a faint line under it. */}
      <div className="absolute inset-x-0 top-0 h-36 overflow-hidden">
        <RemoteImage
          src={view.header}
          fallback={null}
          hasSkeleton={false}
          // A finished game shows its art clearly; until then it stays back.
          className={cn(
            'absolute inset-0 size-full rounded-none',
            isComplete ? 'opacity-60' : 'opacity-35 blur-[2px]',
          )}
        />
        <div className="from-background via-background/80 absolute inset-0 bg-linear-to-t to-transparent" />
      </div>

      <div className="relative px-4 pt-10 pb-3.5">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">
            {view.name}
          </h1>
          {isRunning && (
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
        <div className="mt-1 flex items-center gap-2">
          <p className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-xs tabular-nums">
            <Trophy className="size-3.5 flex-none" />
            {t.game.summary(view.unlockedCount, view.total, percent)}
          </p>
          <Button
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            aria-expanded={isDetailsOpen}
            onClick={onToggleDetails}
          >
            {t.game.details.toggle}
            <ChevronDown
              className={cn(
                'transition-transform duration-150',
                isDetailsOpen && 'rotate-180',
              )}
            />
          </Button>
        </div>
        {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
        {children}
      </div>
    </header>
  );
}
