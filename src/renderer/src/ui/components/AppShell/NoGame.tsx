import { useT } from '@app/hooks/useT';
import { Empty } from '@ui/components/Empty';
import { Button } from '@ui/primitives/button';

interface INoGameProps {
  /** Why the library could not be read; `null` when it was read. */
  error: string | null;
  /** The library is being read for the first time. */
  isLoading: boolean;
  onRetry: () => void;
}

/**
 * The Game tab with no game to show. "Nothing was played" is only said once
 * Steam has answered: when it could not be asked, the reason is shown instead.
 */
export function NoGame({ error, isLoading, onRetry }: INoGameProps) {
  const t = useT();

  return (
    // `relative`: holds the visually hidden heading inside the screen.
    <section className="relative flex-1 overflow-y-auto">
      <h1 className="sr-only">{t.nav.game}</h1>
      {error ? (
        <Empty>
          <p className="text-destructive">{error}</p>
          <Button variant="secondary" onClick={onRetry}>
            {t.common.retry}
          </Button>
        </Empty>
      ) : (
        !isLoading && <Empty>{t.game.none}</Empty>
      )}
    </section>
  );
}
