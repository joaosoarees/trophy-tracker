import { describe, expect, it } from 'vitest';

import { type IAchievement } from '@shared/types/Achievement';
import { type IGameView } from '@shared/types/Game';
import { makeAchievement } from '@tests/factories/makeAchievement';
import { makeGameView } from '@tests/factories/makeGameView';

import {
  completionOf,
  countHidden,
  countMatchesInOtherList,
  listAchievements,
} from './achievementList';

const achievement = (id: string, props: Partial<IAchievement> = {}) =>
  makeAchievement({ id, rarity: 50, ...props });

const view = (achievements: IAchievement[]): IGameView =>
  makeGameView({ achievements });

/** Three pending achievements, one of them with a counter, and two unlocked. */
const makeGame = (): IGameView =>
  view([
    achievement('rare', { rarity: 2, name: 'Zeta' }),
    achievement('common', { rarity: 90, name: 'Alpha' }),
    achievement('halfway', {
      rarity: 40,
      name: 'Mid',
      progress: { current: 5, target: 10 },
    }),
    achievement('old', { unlocked: true, unlockedAt: 100 }),
    achievement('new', { unlocked: true, unlockedAt: 900 }),
  ]);

/** Three unlocked achievements and a pending one. */
const makeUnlockedGame = (): IGameView =>
  view([
    achievement('old', {
      unlocked: true,
      unlockedAt: 100,
      rarity: 80,
      name: 'Beta',
    }),
    achievement('new', {
      unlocked: true,
      unlockedAt: 900,
      rarity: 5,
      name: 'Gamma',
    }),
    achievement('mid', {
      unlocked: true,
      unlockedAt: 500,
      rarity: 40,
      name: 'Alpha',
    }),
    achievement('pending'),
  ]);

/** Two matches of "kodama" unlocked, one pending, and a pending non-match. */
const makeKodamaGame = (): IGameView =>
  view([
    achievement('a', { name: 'Bridge Kodama' }),
    achievement('b', { name: 'Cave Kodama', unlocked: true, unlockedAt: 5 }),
    achievement('c', { name: 'Temple Kodama', unlocked: true, unlockedAt: 9 }),
    achievement('d', { name: 'Boss' }),
  ]);

const PENDING = {
  filter: 'pending',
  sort: 'common',
  query: '',
  locale: 'en-US',
} as const;
const UNLOCKED = { ...PENDING, filter: 'unlocked', sort: 'recent' } as const;

const ids = (list: IAchievement[]) => list.map((a) => a.id);

describe('achievementList', () => {
  describe('listAchievements', () => {
    it('should list only the pending achievements when the filter is pending', () => {
      const game = makeGame();

      const list = listAchievements(game, {}, PENDING);

      expect(ids(list)).toEqual(['common', 'halfway', 'rare']);
    });

    it.each([
      { sort: 'rare', order: ['rare', 'halfway', 'common'] },
      { sort: 'name', order: ['common', 'halfway', 'rare'] },
      { sort: 'closest', order: ['halfway', 'common', 'rare'] },
    ] as const)('should sort the pending list by $sort', ({ sort, order }) => {
      const game = makeGame();

      const list = listAchievements(game, {}, { ...PENDING, sort });

      expect(ids(list)).toEqual(order);
    });

    it.each([
      { sort: 'recent', order: ['new', 'mid', 'old'] },
      { sort: 'oldest', order: ['old', 'mid', 'new'] },
      { sort: 'rare', order: ['new', 'mid', 'old'] },
      { sort: 'common', order: ['old', 'mid', 'new'] },
      { sort: 'name', order: ['mid', 'old', 'new'] },
    ] as const)('should sort the unlocked list by $sort', ({ sort, order }) => {
      const game = makeUnlockedGame();

      const list = listAchievements(game, {}, { ...UNLOCKED, sort });

      expect(ids(list)).toEqual(order);
    });

    it('should sort by name as the language does when a name starts with an accented letter', () => {
      const game = view([
        achievement('z', { name: 'Zèle' }),
        achievement('e', { name: 'Élan' }),
        achievement('a', { name: 'Avant' }),
      ]);

      const list = listAchievements(
        game,
        {},
        { ...PENDING, sort: 'name', locale: 'fr-FR' },
      );

      expect(ids(list)).toEqual(['a', 'e', 'z']);
    });

    it.each([
      { sort: 'common', order: ['common', 'rare', 'unrated'] },
      { sort: 'rare', order: ['rare', 'common', 'unrated'] },
    ] as const)(
      'should put last an achievement of unknown rarity when sorting by $sort',
      ({ sort, order }) => {
        const game = view([
          achievement('unrated', { rarity: null }),
          achievement('rare', { rarity: 2 }),
          achievement('common', { rarity: 90 }),
        ]);

        const list = listAchievements(game, {}, { ...PENDING, sort });

        expect(ids(list)).toEqual(order);
      },
    );

    it('should put last an achievement Steam gives no unlock date for when sorting by recent', () => {
      const game = view([
        achievement('undated', { unlocked: true, unlockedAt: null }),
        achievement('dated', { unlocked: true, unlockedAt: 100 }),
      ]);

      const list = listAchievements(game, {}, UNLOCKED);

      expect(ids(list)).toEqual(['dated', 'undated']);
    });

    it('should put an achievement whose counter has not moved before one with no counter when sorting by closest', () => {
      const game = view([
        achievement('none', { rarity: 90 }),
        achievement('unmoved', {
          rarity: 2,
          progress: { current: 0, target: 10 },
        }),
      ]);

      const list = listAchievements(game, {}, { ...PENDING, sort: 'closest' });

      expect(ids(list)).toEqual(['unmoved', 'none']);
    });

    it('should count a user checklist as progress when sorting by closest', () => {
      const game = makeGame();
      const userData = {
        rare: {
          note: '',
          pinned: false,
          checklist: [
            { id: '1', text: 'a', done: true },
            { id: '2', text: 'b', done: true },
            { id: '3', text: 'c', done: false },
          ],
        },
      };

      const list = listAchievements(game, userData, {
        ...PENDING,
        sort: 'closest',
      });

      expect(ids(list)).toEqual(['rare', 'halfway', 'common']);
    });

    it.each([
      { sort: 'common', order: ['halfway', 'common', 'rare'] },
      { sort: 'name', order: ['halfway', 'common', 'rare'] },
    ] as const)(
      'should keep a pinned achievement on top when sorting by $sort',
      ({ sort, order }) => {
        const game = makeGame();
        const userData = { halfway: { note: '', pinned: true } };

        const list = listAchievements(game, userData, { ...PENDING, sort });

        expect(ids(list)).toEqual(order);
      },
    );

    it.each([
      { options: PENDING, hidden: ['a'] },
      { options: UNLOCKED, hidden: ['c'] },
    ])(
      'should keep only the hidden achievements of the $options.filter list when asked to',
      ({ options, hidden }) => {
        const game = view([
          achievement('a', { hidden: true }),
          achievement('b'),
          achievement('c', { hidden: true, unlocked: true, unlockedAt: 5 }),
          achievement('d', { unlocked: true, unlockedAt: 9 }),
        ]);

        const list = listAchievements(
          game,
          {},
          { ...options, isHiddenOnly: true },
        );

        expect(ids(list)).toEqual(hidden);
      },
    );

    it.each([
      { field: 'a name, whatever the accents', query: 'voce', found: ['a'] },
      {
        field: 'a description, whatever the case and the spaces around',
        query: ' kodama ',
        found: ['b'],
      },
      { field: 'nothing', query: 'xyz', found: [] },
    ])(
      'should find $found when the search matches $field',
      ({ query, found }) => {
        const game = view([
          achievement('a', { name: 'Você é Nioh' }),
          achievement('b', { description: 'Collect every KODAMA' }),
          achievement('c'),
        ]);

        const list = listAchievements(game, {}, { ...PENDING, query });

        expect(ids(list)).toEqual(found);
      },
    );
  });

  describe('countHidden', () => {
    it.each([
      { filter: 'pending', count: 2 },
      { filter: 'unlocked', count: 1 },
    ] as const)(
      'should count $count hidden achievements when the list is $filter',
      ({ filter, count }) => {
        const game = view([
          achievement('a', { hidden: true }),
          achievement('b', { hidden: true }),
          achievement('c'),
          achievement('d', { hidden: true, unlocked: true, unlockedAt: 5 }),
          achievement('e', { unlocked: true, unlockedAt: 9 }),
        ]);

        const hiddenCount = countHidden(game, filter);

        expect(hiddenCount).toBe(count);
      },
    );
  });

  describe('countMatchesInOtherList', () => {
    it('should count the matches in the unlocked list when pending is shown', () => {
      const game = makeKodamaGame();

      const count = countMatchesInOtherList(game, 'pending', 'kodama');

      expect(count).toBe(2);
    });

    it('should count the matches in the pending list when unlocked is shown', () => {
      const game = makeKodamaGame();

      const count = countMatchesInOtherList(game, 'unlocked', 'kodama');

      expect(count).toBe(1);
    });

    it('should count nothing when there is no search', () => {
      const game = makeKodamaGame();

      const count = countMatchesInOtherList(game, 'pending', '  ');

      expect(count).toBe(0);
    });
  });

  describe('completionOf', () => {
    it('should take the completion date from the last achievement unlocked', () => {
      const game = view([
        achievement('a', { unlocked: true, unlockedAt: 100 }),
        achievement('b', { unlocked: true, unlockedAt: 900 }),
        achievement('c', { unlocked: true, unlockedAt: 500 }),
      ]);

      const completion = completionOf(game);

      expect(completion.completedAt).toBe(900);
    });

    it('should have no completion date when Steam reports none', () => {
      const game = view([achievement('a', { unlocked: true })]);

      const completion = completionOf(game);

      expect(completion.completedAt).toBeNull();
    });

    it('should name the achievement fewest players have as the rarest', () => {
      const rare = achievement('rare', { unlocked: true, rarity: 0.4 });
      const game = view([
        achievement('common', { unlocked: true, rarity: 80 }),
        rare,
        achievement('unknown', { unlocked: true, rarity: null }),
      ]);

      const completion = completionOf(game);

      expect(completion.rarest).toEqual(rare);
    });

    it('should name no rarest achievement when no rarity is known', () => {
      const game = view([achievement('a', { unlocked: true, rarity: null })]);

      const completion = completionOf(game);

      expect(completion.rarest).toBeNull();
    });
  });
});
