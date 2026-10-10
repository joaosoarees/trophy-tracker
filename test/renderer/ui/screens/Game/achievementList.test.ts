import { describe, expect, it } from 'vitest';

import { type IAchievement } from '@shared/types/Achievement';
import { makeAchievement } from '@test/factories/makeAchievement';
import { makeGameView } from '@test/factories/makeGameView';
import {
  completionOf,
  countHidden,
  countMatchesInOtherList,
  listAchievements,
} from '@ui/screens/Game/achievementList';

const achievement = (id: string, over: Partial<IAchievement> = {}) =>
  makeAchievement({ id, rarity: 50, ...over });

const view = (achievements: IAchievement[]) => makeGameView({ achievements });

const game = view([
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

const base = {
  filter: 'pending',
  sort: 'common',
  query: '',
  locale: 'en-US',
} as const;
const ids = (list: IAchievement[]) => list.map((a) => a.id);

describe('listAchievements', () => {
  it('shows only pending ones, most common first', () => {
    expect(ids(listAchievements(game, {}, base))).toEqual([
      'common',
      'halfway',
      'rare',
    ]);
  });

  it.each([
    { sort: 'rare', order: ['rare', 'halfway', 'common'] },
    { sort: 'name', order: ['common', 'halfway', 'rare'] },
    { sort: 'closest', order: ['halfway', 'common', 'rare'] },
  ] as const)('sorts the pending list by $sort', ({ sort, order }) => {
    expect(ids(listAchievements(game, {}, { ...base, sort }))).toEqual(order);
  });

  it('counts a user checklist as progress when sorting by closest', () => {
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
    expect(
      ids(listAchievements(game, userData, { ...base, sort: 'closest' })),
    ).toEqual(['rare', 'halfway', 'common']);
  });

  it('keeps pinned achievements on top whatever the sort', () => {
    const userData = { rare: { note: '', pinned: true } };
    expect(ids(listAchievements(game, userData, base))[0]).toBe('rare');
    expect(
      ids(listAchievements(game, userData, { ...base, sort: 'name' }))[0],
    ).toBe('rare');
  });

  it.each([
    { sort: 'recent', order: ['new', 'mid', 'old'] },
    { sort: 'oldest', order: ['old', 'mid', 'new'] },
    { sort: 'rare', order: ['new', 'mid', 'old'] },
    { sort: 'common', order: ['old', 'mid', 'new'] },
    { sort: 'name', order: ['mid', 'old', 'new'] },
  ] as const)('sorts the unlocked list by $sort', ({ sort, order }) => {
    const unlocked = view([
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

    const list = listAchievements(
      unlocked,
      {},
      { ...base, filter: 'unlocked', sort },
    );

    expect(ids(list)).toEqual(order);
  });

  it('can keep only the hidden achievements of the list', () => {
    const mixed = view([
      achievement('a', { hidden: true }),
      achievement('b'),
      achievement('c', { hidden: true, unlocked: true, unlockedAt: 5 }),
      achievement('d', { unlocked: true, unlockedAt: 9 }),
    ]);
    expect(
      ids(listAchievements(mixed, {}, { ...base, isHiddenOnly: true })),
    ).toEqual(['a']);
    expect(
      ids(
        listAchievements(
          mixed,
          {},
          {
            ...base,
            filter: 'unlocked',
            sort: 'recent',
            isHiddenOnly: true,
          },
        ),
      ),
    ).toEqual(['c']);
    expect(countHidden(mixed, 'pending')).toBe(1);
    expect(countHidden(mixed, 'unlocked')).toBe(1);
  });

  it('searches name and description without caring about accents or case', () => {
    const accented = view([
      achievement('a', { name: 'Você é Nioh' }),
      achievement('b', { description: 'Collect every KODAMA' }),
      achievement('c'),
    ]);
    expect(
      ids(listAchievements(accented, {}, { ...base, query: 'voce' })),
    ).toEqual(['a']);
    expect(
      ids(listAchievements(accented, {}, { ...base, query: ' kodama ' })),
    ).toEqual(['b']);
    expect(listAchievements(accented, {}, { ...base, query: 'xyz' })).toEqual(
      [],
    );
  });
});

describe('countMatchesInOtherList', () => {
  const lists = view([
    achievement('a', { name: 'Bridge Kodama' }),
    achievement('b', { name: 'Cave Kodama', unlocked: true, unlockedAt: 5 }),
    achievement('c', { name: 'Temple Kodama', unlocked: true, unlockedAt: 9 }),
    achievement('d', { name: 'Boss' }),
  ]);

  it('counts the matches that are in the unlocked list while pending is shown', () => {
    expect(countMatchesInOtherList(lists, 'pending', 'kodama')).toBe(2);
  });

  it('counts the matches that are in the pending list while unlocked is shown', () => {
    expect(countMatchesInOtherList(lists, 'unlocked', 'kodama')).toBe(1);
  });

  it('counts nothing without a search', () => {
    expect(countMatchesInOtherList(lists, 'pending', '  ')).toBe(0);
  });
});

describe('completionOf', () => {
  it('takes the completion date from the last achievement unlocked', () => {
    const done = view([
      achievement('a', { unlocked: true, unlockedAt: 100 }),
      achievement('b', { unlocked: true, unlockedAt: 900 }),
      achievement('c', { unlocked: true, unlockedAt: 500 }),
    ]);

    expect(completionOf(done).completedAt).toBe(900);
  });

  it('has no completion date when Steam reports none', () => {
    const undated = view([achievement('a', { unlocked: true })]);

    expect(completionOf(undated).completedAt).toBeNull();
  });

  it('names the achievement fewest players have', () => {
    const done = view([
      achievement('common', { unlocked: true, rarity: 80 }),
      achievement('rare', { unlocked: true, rarity: 0.4 }),
      achievement('unknown', { unlocked: true, rarity: null }),
    ]);

    expect(completionOf(done).rarest?.id).toBe('rare');
  });

  it('names no rarest achievement when no rarity is known', () => {
    const unrated = view([achievement('a', { unlocked: true, rarity: null })]);

    expect(completionOf(unrated).rarest).toBeNull();
  });
});
