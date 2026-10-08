import { describe, expect, it } from 'vitest';

import { type IGameSummary } from '@shared/types/Game';
import { countGames, listGames } from '@ui/screens/Dashboard/gameList';

const game = (
  name: string,
  unlocked: number,
  total: number,
  over: Partial<IGameSummary> = {},
): IGameSummary => ({
  appid: name.length * 1000 + unlocked,
  name,
  icon: '',
  capsule: '',
  playtimeMinutes: 10,
  lastPlayed: 0,
  total,
  unlocked,
  completedAt: null,
  ...over,
});

const games = [
  game('Half', 5, 10, { lastPlayed: 300 }),
  game('Almost', 19, 20, { lastPlayed: 100 }),
  game('Barely', 1, 100, { lastPlayed: 900 }),
  game('Old win', 10, 10, { completedAt: 100, lastPlayed: 800 }),
  game('New win', 30, 30, { completedAt: 900, lastPlayed: 200 }),
];
const base = {
  filter: 'ongoing',
  sort: 'closest',
  query: '',
  locale: 'en-US',
} as const;
const names = (list: IGameSummary[]) => list.map((g) => g.name);

describe('listGames', () => {
  it('shows only games in progress, closest to 100% first', () => {
    expect(names(listGames(games, base))).toEqual(['Almost', 'Half', 'Barely']);
  });

  it('sorts games in progress by last played, fewest left and name', () => {
    expect(names(listGames(games, { ...base, sort: 'played' }))).toEqual([
      'Barely',
      'Half',
      'Almost',
    ]);
    expect(names(listGames(games, { ...base, sort: 'fewest' }))).toEqual([
      'Almost',
      'Half',
      'Barely',
    ]);
    expect(names(listGames(games, { ...base, sort: 'name' }))).toEqual([
      'Almost',
      'Barely',
      'Half',
    ]);
  });

  it('shows complete games, most recently completed first by default', () => {
    const complete = { ...base, filter: 'complete' } as const;
    expect(names(listGames(games, { ...complete, sort: 'completed' }))).toEqual(
      ['New win', 'Old win'],
    );
    expect(names(listGames(games, { ...complete, sort: 'played' }))).toEqual([
      'Old win',
      'New win',
    ]);
  });

  it('searches by name inside the list being shown', () => {
    expect(names(listGames(games, { ...base, query: 'WIN' }))).toEqual([]);
    expect(
      names(
        listGames(games, {
          ...base,
          filter: 'complete',
          sort: 'name',
          query: 'win',
        }),
      ),
    ).toEqual(['New win', 'Old win']);
  });
});

describe('countGames', () => {
  it('counts each list, and how many of each match the search', () => {
    expect(countGames(games, '')).toEqual({
      ongoing: 3,
      complete: 2,
      matching: { ongoing: 3, complete: 2 },
    });
    expect(countGames(games, 'win').matching).toEqual({
      ongoing: 0,
      complete: 2,
    });
  });
});
