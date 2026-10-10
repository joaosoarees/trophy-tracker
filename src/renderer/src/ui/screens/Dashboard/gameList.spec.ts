import { describe, expect, it } from 'vitest';

import { type IGameSummary } from '@shared/types/Game';
import { makeGameSummary } from '@tests/factories/makeGameSummary';

import { countGames, listGames } from './gameList';

/** Three games in progress and two complete ones, in no useful order. */
const makeLibrary = (): IGameSummary[] => [
  makeGameSummary({ name: 'Half', unlocked: 5, total: 10, lastPlayed: 300 }),
  makeGameSummary({ name: 'Almost', unlocked: 19, total: 20, lastPlayed: 100 }),
  makeGameSummary({ name: 'Barely', unlocked: 1, total: 100, lastPlayed: 900 }),
  makeGameSummary({
    name: 'Old win',
    unlocked: 10,
    total: 10,
    completedAt: 100,
    lastPlayed: 800,
  }),
  makeGameSummary({
    name: 'New win',
    unlocked: 30,
    total: 30,
    completedAt: 900,
    lastPlayed: 200,
  }),
];

const ONGOING = {
  filter: 'ongoing',
  sort: 'closest',
  query: '',
  locale: 'en-US',
} as const;
const COMPLETE = { ...ONGOING, filter: 'complete', sort: 'completed' } as const;

const names = (list: IGameSummary[]) => list.map((game) => game.name);

describe('gameList', () => {
  describe('listGames', () => {
    it('should list only the games in progress when the filter is ongoing', () => {
      const library = makeLibrary();

      const list = listGames(library, { ...ONGOING, sort: 'name' });

      expect(names(list)).toEqual(['Almost', 'Barely', 'Half']);
    });

    it('should list only the complete games when the filter is complete', () => {
      const library = makeLibrary();

      const list = listGames(library, { ...COMPLETE, sort: 'name' });

      expect(names(list)).toEqual(['New win', 'Old win']);
    });

    it.each([
      { sort: 'closest', order: ['Almost', 'Half', 'Barely'] },
      { sort: 'played', order: ['Barely', 'Half', 'Almost'] },
      { sort: 'fewest', order: ['Almost', 'Half', 'Barely'] },
    ] as const)(
      'should sort the games in progress by $sort',
      ({ sort, order }) => {
        const library = makeLibrary();

        const list = listGames(library, { ...ONGOING, sort });

        expect(names(list)).toEqual(order);
      },
    );

    it.each([
      { sort: 'completed', order: ['New win', 'Old win'] },
      { sort: 'played', order: ['Old win', 'New win'] },
    ] as const)(
      'should sort the complete games by $sort',
      ({ sort, order }) => {
        const library = makeLibrary();

        const list = listGames(library, { ...COMPLETE, sort });

        expect(names(list)).toEqual(order);
      },
    );

    it('should sort by name as the language does when a name starts with an accented letter', () => {
      const library = ['Zelda', 'Élan', 'Abzu'].map((name) =>
        makeGameSummary({ name, unlocked: 1 }),
      );

      const list = listGames(library, {
        ...ONGOING,
        sort: 'name',
        locale: 'fr-FR',
      });

      expect(names(list)).toEqual(['Abzu', 'Élan', 'Zelda']);
    });

    it('should put first the game played last when two are as close to complete', () => {
      const library = [
        makeGameSummary({ name: 'Earlier', unlocked: 5, lastPlayed: 100 }),
        makeGameSummary({ name: 'Later', unlocked: 5, lastPlayed: 900 }),
      ];

      const list = listGames(library, { ...ONGOING, sort: 'closest' });

      expect(names(list)).toEqual(['Later', 'Earlier']);
    });

    it('should put first the game closest to complete when two have as few achievements left', () => {
      const library = [
        makeGameSummary({ name: 'Small', unlocked: 8, total: 10 }),
        makeGameSummary({ name: 'Large', unlocked: 98, total: 100 }),
      ];

      const list = listGames(library, { ...ONGOING, sort: 'fewest' });

      expect(names(list)).toEqual(['Large', 'Small']);
    });

    it('should put first the game played last when two were completed at the same time', () => {
      const done = { unlocked: 10, completedAt: 500 };
      const library = [
        makeGameSummary({ ...done, name: 'Earlier', lastPlayed: 100 }),
        makeGameSummary({ ...done, name: 'Later', lastPlayed: 900 }),
      ];

      const list = listGames(library, COMPLETE);

      expect(names(list)).toEqual(['Later', 'Earlier']);
    });

    it('should put last a complete game with no completion date when sorting by completion', () => {
      const library = [
        makeGameSummary({ name: 'Undated', unlocked: 10, completedAt: null }),
        makeGameSummary({ name: 'Dated', unlocked: 10, completedAt: 500 }),
      ];

      const list = listGames(library, COMPLETE);

      expect(names(list)).toEqual(['Dated', 'Undated']);
    });

    it('should list only the games whose name matches when there is a search', () => {
      const library = makeLibrary();

      const list = listGames(library, { ...COMPLETE, query: 'OLD' });

      expect(names(list)).toEqual(['Old win']);
    });

    it('should not list a matching game when it is in the other list', () => {
      const library = makeLibrary();

      const list = listGames(library, { ...ONGOING, query: 'win' });

      expect(list).toEqual([]);
    });
  });

  describe('countGames', () => {
    it('should count every game of each list as matching when there is no search', () => {
      const library = makeLibrary();

      const counts = countGames(library, '');

      expect(counts).toEqual({
        ongoing: 3,
        complete: 2,
        matching: { ongoing: 3, complete: 2 },
      });
    });

    it('should count the matches apart from the size of each list when there is a search', () => {
      const library = makeLibrary();

      const counts = countGames(library, 'old');

      expect(counts).toEqual({
        ongoing: 3,
        complete: 2,
        matching: { ongoing: 0, complete: 1 },
      });
    });
  });
});
