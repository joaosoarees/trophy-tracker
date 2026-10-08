import {
  type DashboardFilter,
  type DashboardSort,
} from '@shared/dashboardSort';
import { type IGameSummary } from '@shared/types/Game';
import { matches } from '@ui/utils/text';

interface IListOptions {
  filter: DashboardFilter;
  /** The order chosen for the list being shown. */
  sort: DashboardSort;
  query: string;
  locale: string;
}

type Compare = (a: IGameSummary, b: IGameSummary) => number;

export const isComplete = (game: IGameSummary): boolean =>
  game.unlocked === game.total;

const inList = (game: IGameSummary, filter: DashboardFilter): boolean =>
  isComplete(game) === (filter === 'complete');

/** The games a dashboard list shows: ongoing or complete, matching the search, in the chosen order. */
export function listGames(
  games: IGameSummary[],
  { filter, sort, query, locale }: IListOptions,
): IGameSummary[] {
  const ratio = (game: IGameSummary): number => game.unlocked / game.total;
  const left = (game: IGameSummary): number => game.total - game.unlocked;
  const byName: Compare = (a, b) => a.name.localeCompare(b.name, locale);
  const byPlayed: Compare = (a, b) => b.lastPlayed - a.lastPlayed;
  const by: Record<DashboardSort, Compare> = {
    closest: (a, b) => ratio(b) - ratio(a) || byPlayed(a, b),
    played: byPlayed,
    fewest: (a, b) => left(a) - left(b) || ratio(b) - ratio(a),
    name: byName,
    completed: (a, b) =>
      (b.completedAt ?? 0) - (a.completedAt ?? 0) || byPlayed(a, b),
  };

  return games
    .filter((game) => inList(game, filter) && matches(query, game.name))
    .sort(by[sort]);
}

/** How many games each list has, and how many of them match the search. */
export function countGames(games: IGameSummary[], query: string) {
  const count = (filter: DashboardFilter, matching: boolean): number =>
    games.filter(
      (game) =>
        inList(game, filter) && (!matching || matches(query, game.name)),
    ).length;

  return {
    ongoing: count('ongoing', false),
    complete: count('complete', false),
    matching: {
      ongoing: count('ongoing', true),
      complete: count('complete', true),
    },
  };
}
