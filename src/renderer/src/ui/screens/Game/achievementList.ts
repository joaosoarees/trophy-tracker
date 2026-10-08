import {
  type AchievementFilter,
  type AchievementSort,
} from '@shared/achievementSort';
import { shownProgress } from '@shared/checklist';
import { type IAchievement } from '@shared/types/Achievement';
import { type IGameView } from '@shared/types/Game';
import { type GameUserData } from '@shared/types/UserData';
import { matches } from '@ui/utils/text';

interface IListOptions {
  filter: AchievementFilter;
  /** The order chosen for the list being shown. */
  sort: AchievementSort;
  query: string;
  locale: string;
  /** Keep only the achievements Steam marks as hidden. */
  hiddenOnly?: boolean;
}

type Compare = (a: IAchievement, b: IAchievement) => number;

/**
 * The achievements a game screen shows: pending or unlocked, matching the
 * search, in the chosen order, pinned ones first.
 */
export function listAchievements(
  view: IGameView,
  userData: GameUserData,
  { filter, sort, query, locale, hiddenOnly = false }: IListOptions,
): IAchievement[] {
  const ratio = (a: IAchievement): number => {
    const progress = shownProgress(a, userData[a.id]);
    return progress ? progress.current / progress.target : -1;
  };
  const byRarity: Compare = (a, b) => (b.rarity ?? -1) - (a.rarity ?? -1);
  const newestFirst: Compare = (a, b) =>
    (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0);
  const by: Record<AchievementSort, Compare> = {
    common: byRarity,
    rare: (a, b) => (a.rarity ?? 101) - (b.rarity ?? 101),
    closest: (a, b) => ratio(b) - ratio(a) || byRarity(a, b),
    name: (a, b) => a.name.localeCompare(b.name, locale),
    recent: newestFirst,
    oldest: (a, b) => newestFirst(b, a),
  };
  const order = by[sort];
  const pinned = (a: IAchievement): number => (userData[a.id]?.pinned ? 1 : 0);

  return view.achievements
    .filter(
      (a) =>
        a.unlocked === (filter === 'unlocked') &&
        (!hiddenOnly || a.hidden) &&
        matches(query, a.name, a.description),
    )
    .sort((a, b) => pinned(b) - pinned(a) || order(a, b));
}

/** How many hidden achievements a list has, whatever the search. */
export function countHidden(
  view: IGameView,
  filter: AchievementFilter,
): number {
  return view.achievements.filter(
    (a) => a.hidden && a.unlocked === (filter === 'unlocked'),
  ).length;
}

/**
 * How many achievements of the list that is NOT shown match the search, so a
 * search that finds nothing here can say where the matches are.
 */
export function countMatchesInOtherList(
  view: IGameView,
  filter: AchievementFilter,
  query: string,
): number {
  if (query.trim() === '') return 0;
  return view.achievements.filter(
    (a) =>
      a.unlocked !== (filter === 'unlocked') &&
      matches(query, a.name, a.description),
  ).length;
}

export interface ICompletion {
  /** When the last achievement was unlocked (epoch in seconds), if Steam reports it. */
  completedAt: number | null;
  /** The achievement fewest players have, among those with a known rarity. */
  rarest: IAchievement | null;
}

/** What there is to say about a game with every achievement unlocked. */
export function completionOf(view: IGameView): ICompletion {
  const dates = view.achievements
    .map((a) => a.unlockedAt)
    .filter((at): at is number => at !== null);
  const withRarity = view.achievements.filter((a) => a.rarity !== null);

  return {
    completedAt: dates.length > 0 ? Math.max(...dates) : null,
    rarest:
      withRarity.length > 0
        ? withRarity.reduce((rarest, a) =>
            (a.rarity ?? 101) < (rarest.rarity ?? 101) ? a : rarest,
          )
        : null,
  };
}
