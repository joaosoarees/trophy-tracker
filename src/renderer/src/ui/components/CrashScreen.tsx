import { TriangleAlert } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { WindowBar } from '@ui/components/WindowBar';
import { Button } from '@ui/primitives/button';

/** What the user sees when a screen fails to draw. */
export function CrashScreen() {
  const t = useT();

  return (
    <>
      <WindowBar />
      <main className="h-below-window-bar">
        {/* The announcement sits inside the landmark: `main` cannot be an alert itself. */}
        <div
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
        >
          <TriangleAlert className="text-warning size-8" />
          <h1 className="text-xl font-semibold">{t.crash.title}</h1>
          <p className="text-muted-foreground max-w-sm">
            {t.crash.description}
          </p>
          <Button onClick={() => window.location.reload()}>
            {t.crash.reload}
          </Button>
        </div>
      </main>
    </>
  );
}
