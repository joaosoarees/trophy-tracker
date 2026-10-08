import { useLocale } from '@app/hooks/useLocale';
import { useT } from '@app/hooks/useT';
import { Button } from '@ui/primitives/button';
import { formatDate, formatPercent } from '@ui/utils/format';

import { type ICompletion } from '../achievementList';

interface IGameCompleteProps {
  completion: ICompletion;
  onSeeUnlocked: () => void;
}

/**
 * Takes the place of the pending list once nothing is pending. Finishing a
 * game is what the app is for, so it gets the one large figure in the
 * interface instead of an empty list.
 */
export function GameComplete({
  completion,
  onSeeUnlocked,
}: IGameCompleteProps) {
  const t = useT();
  const locale = useLocale();
  const { completedAt, rarest } = completion;

  return (
    <div className="animate-screen-in flex flex-col items-center gap-1 px-6 py-10 text-center">
      <strong className="text-success text-4xl leading-none font-semibold tabular-nums">
        100%
      </strong>
      <h2 className="mt-3 font-semibold">{t.game.complete.title}</h2>
      {/* The count and the percentage are already in the header above. */}
      {completedAt !== null && (
        <p className="text-muted-foreground text-xs tabular-nums">
          {t.game.complete.completedOn(formatDate(completedAt, locale))}
        </p>
      )}
      {rarest?.rarity != null && (
        <p className="text-muted-foreground text-xs">
          {t.game.complete.rarest(
            rarest.name,
            formatPercent(rarest.rarity, locale),
          )}
        </p>
      )}
      <Button className="mt-5" onClick={onSeeUnlocked}>
        {t.game.complete.seeUnlocked}
      </Button>
    </div>
  );
}
