import { describe, expect, it } from 'vitest';

import { listAchievements } from '../src/renderer/src/ui/screens/Game/achievementList';
import { type IAchievement, type IGameView } from '../src/shared/types';

const achievement = (
  id: string,
  over: Partial<IAchievement> = {},
): IAchievement => ({
  id,
  name: id,
  description: '',
  hidden: false,
  icon: '',
  iconGray: '',
  rarity: 50,
  unlocked: false,
  unlockedAt: null,
  progress: null,
  ...over,
});

const view = (achievements: IAchievement[]): IGameView => ({
  appid: 1,
  name: 'Game',
  total: achievements.length,
  unlockedCount: achievements.filter((a) => a.unlocked).length,
  achievements,
  fetchedAt: 1,
});

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

  it('shows unlocked ones newest first, ignoring the sort', () => {
    expect(
      ids(
        listAchievements(
          game,
          {},
          { ...base, filter: 'unlocked', sort: 'name' },
        ),
      ),
    ).toEqual(['new', 'old']);
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
