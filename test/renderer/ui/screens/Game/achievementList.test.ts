import { describe, expect, it } from 'vitest';

import { type IAchievement } from '@shared/types/Achievement';
import { makeAchievement } from '@test/factories/makeAchievement';
import { makeGameView } from '@test/factories/makeGameView';
import {
  countHidden,
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

  it('sorts by rarest, by name and by closest to done', () => {
    expect(ids(listAchievements(game, {}, { ...base, sort: 'rare' }))).toEqual([
      'rare',
      'halfway',
      'common',
    ]);
    expect(ids(listAchievements(game, {}, { ...base, sort: 'name' }))).toEqual([
      'common',
      'halfway',
      'rare',
    ]);
    expect(
      ids(listAchievements(game, {}, { ...base, sort: 'closest' })),
    ).toEqual(['halfway', 'common', 'rare']);
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

  it('sorts the unlocked list by date, rarity or name', () => {
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
    const sorted = (sort: 'recent' | 'oldest' | 'rare' | 'common' | 'name') =>
      ids(
        listAchievements(unlocked, {}, { ...base, filter: 'unlocked', sort }),
      );

    expect(sorted('recent')).toEqual(['new', 'mid', 'old']);
    expect(sorted('oldest')).toEqual(['old', 'mid', 'new']);
    expect(sorted('rare')).toEqual(['new', 'mid', 'old']);
    expect(sorted('common')).toEqual(['old', 'mid', 'new']);
    expect(sorted('name')).toEqual(['mid', 'old', 'new']);
  });

  it('can keep only the hidden achievements of the list', () => {
    const mixed = view([
      achievement('a', { hidden: true }),
      achievement('b'),
      achievement('c', { hidden: true, unlocked: true, unlockedAt: 5 }),
      achievement('d', { unlocked: true, unlockedAt: 9 }),
    ]);
    expect(
      ids(listAchievements(mixed, {}, { ...base, hiddenOnly: true })),
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
            hiddenOnly: true,
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
