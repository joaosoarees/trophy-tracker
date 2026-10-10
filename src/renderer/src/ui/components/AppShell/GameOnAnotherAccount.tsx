import { useT } from '@app/hooks/useT';
import { Empty } from '@ui/components/Empty';
import { Button } from '@ui/primitives/button';

interface IGameOnAnotherAccountProps {
  onAddAccount: () => void;
}

/**
 * The Game tab while a game runs on a Steam account the app does not have.
 * There is nothing of that game to show, and saying nothing would look like
 * the app had stopped following Steam: it says why, and offers the way out.
 */
export function GameOnAnotherAccount({
  onAddAccount,
}: IGameOnAnotherAccountProps) {
  const t = useT();

  return (
    // `relative`: holds the visually hidden heading inside the screen.
    <section className="relative flex-1 overflow-y-auto">
      <h1 className="sr-only">{t.nav.game}</h1>
      <Empty>
        <p>{t.accounts.gameOnAnotherAccount}</p>
        <Button variant="secondary" onClick={onAddAccount}>
          {t.accounts.add}
        </Button>
      </Empty>
    </section>
  );
}
