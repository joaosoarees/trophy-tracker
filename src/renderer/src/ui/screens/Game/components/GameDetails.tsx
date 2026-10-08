import { useLocale } from '@app/hooks/useLocale';
import { useT } from '@app/hooks/useT';
import { type IAchievement } from '@shared/types/Achievement';
import { DetailGroup, DetailRow } from '@ui/components/DetailList';
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatPlaytime,
} from '@ui/utils/format';

import { type IGameDetails } from '../gameDetails';

interface IGameDetailsProps {
  details: IGameDetails;
  /** Minutes played and when, from the library; `null` when it was not read. */
  playtimeMinutes: number | null;
  lastPlayed: number | null;
  /** Shows an achievement in the list. */
  onFind: (achievement: IAchievement) => void;
}

/**
 * Where the player stands in the game and what to go for next. Rows that
 * name an achievement lead to it in the list.
 */
export function GameDetails({
  details,
  playtimeMinutes,
  lastPlayed,
  onFind,
}: IGameDetailsProps) {
  const t = useT();
  const locale = useLocale();
  const { lastUnlocked, easiest, rarest, closest } = details;
  const hasLeft = easiest !== null || closest !== null;

  const rarity = (achievement: IAchievement) =>
    achievement.rarity === null
      ? null
      : formatPercent(achievement.rarity, locale);

  return (
    <div className="expand-in">
      <div className="flex flex-col gap-4 pt-4">
        <DetailGroup title={t.game.details.progress}>
          {playtimeMinutes !== null && (
            <DetailRow label={t.game.details.playtime}>
              {formatPlaytime(playtimeMinutes)}
            </DetailRow>
          )}
          {lastPlayed !== null && (
            <DetailRow label={t.game.details.lastPlayed}>
              {lastPlayed > 0
                ? formatDate(lastPlayed, locale)
                : t.game.details.never}
            </DetailRow>
          )}
          {lastUnlocked ? (
            <DetailRow
              label={t.game.details.lastUnlocked}
              description={lastUnlocked.name}
              onClick={() => onFind(lastUnlocked)}
            >
              {lastUnlocked.unlockedAt !== null &&
                formatDate(lastUnlocked.unlockedAt, locale)}
            </DetailRow>
          ) : (
            <DetailRow label={t.game.details.lastUnlocked}>
              {t.game.details.never}
            </DetailRow>
          )}
        </DetailGroup>

        {hasLeft && (
          <DetailGroup title={t.game.details.left}>
            {closest && (
              <DetailRow
                label={t.game.details.closest}
                description={closest.achievement.name}
                onClick={() => onFind(closest.achievement)}
              >
                {formatNumber(closest.current, locale)} /{' '}
                {formatNumber(closest.target, locale)}
              </DetailRow>
            )}
            {easiest && (
              <DetailRow
                label={t.game.details.easiest}
                description={easiest.name}
                onClick={() => onFind(easiest)}
              >
                {rarity(easiest)}
              </DetailRow>
            )}
            {rarest && (
              <DetailRow
                label={t.game.details.rarest}
                description={rarest.name}
                onClick={() => onFind(rarest)}
              >
                {rarity(rarest)}
              </DetailRow>
            )}
          </DetailGroup>
        )}
      </div>
    </div>
  );
}
