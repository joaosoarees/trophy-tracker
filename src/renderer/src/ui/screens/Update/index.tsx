import { Trophy } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { ProgressBar } from '@ui/components/ProgressBar';

interface IUpdateProps {
  /** Version being downloaded; `null` while the app is still checking. */
  version: string | null;
  /** From 0 to 100. */
  percent: number;
}

/** Shown as the app opens: the check for a new version and, if there is one, its download. */
export function Update({ version, percent }: IUpdateProps) {
  const t = useT();

  return (
    <main
      className="animate-screen-in flex h-screen flex-col items-center justify-center gap-4 p-8 text-center"
      aria-busy="true"
    >
      <Trophy className="text-primary size-10" aria-hidden />
      <h1 className="text-xl font-semibold">{t.appTitle}</h1>

      {version === null ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t.update.checking}
        </p>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-2">
          <p role="status" className="font-medium">
            {t.update.found(version)}
          </p>
          <ProgressBar value={percent} className="h-2" />
          <p className="text-muted-foreground text-sm tabular-nums">
            {t.update.downloading(percent)}
          </p>
          <p className="text-muted-foreground pt-2 text-xs">
            {t.update.restartNotice}
          </p>
        </div>
      )}
    </main>
  );
}
