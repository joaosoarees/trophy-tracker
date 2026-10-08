import { shownProgress } from '@shared/checklist';
import { type IAchievement } from '@shared/types/Achievement';
import { type IGameView } from '@shared/types/Game';
import { type GameUserData } from '@shared/types/UserData';
import { matches } from '@ui/utils/text';

export type Sort = 'common' | 'rare' | 'closest' | 'name';
export type Filter = 'pending' | 'unlocked';

export const SORTS: Sort[] = ['common', 'rare', 'closest', 'name'];

interface IListOptions {
  filter: Filter;
  sort: Sort;
  query: string;
  locale: string;
}

type Compare = (a: IAchievement, b: IAchievement) => number;

/**
 * The achievements a game screen shows: pending or unlocked, matching the
 * search, pinned ones first. Unlocked ones are always newest first; `sort`
 * applies to the pending ones.
 */
export function listAchievements(
  view: IGameView,
  userData: GameUserData,
  { filter, sort, query, locale }: IListOptions,
): IAchievement[] {
  const ratio = (a: IAchievement): number => {
    const progress = shownProgress(a, userData[a.id]);
    return progress ? progress.current / progress.target : -1;
  };
  const byRarity: Compare = (a, b) => (b.rarity ?? -1) - (a.rarity ?? -1);
  const by: Record<Sort, Compare> = {
    common: byRarity,
    rare: (a, b) => (a.rarity ?? 101) - (b.rarity ?? 101),
    closest: (a, b) => ratio(b) - ratio(a) || byRarity(a, b),
    name: (a, b) => a.name.localeCompare(b.name, locale),
  };
  const newestFirst: Compare = (a, b) =>
    (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0);
  const order = filter === 'unlocked' ? newestFirst : by[sort];
  const pinned = (a: IAchievement): number => (userData[a.id]?.pinned ? 1 : 0);

  return view.achievements
    .filter(
      (a) =>
        a.unlocked === (filter === 'unlocked') &&
        matches(query, a.name, a.description),
    )
    .sort((a, b) => pinned(b) - pinned(a) || order(a, b));
}
