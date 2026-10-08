import { describe, expect, it } from 'vitest';

import type { IAchievement, IGameView } from '../src/shared/types';
import { mergeView } from '../src/shared/view';

const ach = (id: string, over: Partial<IAchievement> = {}): IAchievement => ({
  id,
  name: id,
  description: '',
  hidden: false,
  icon: '',
  iconGray: '',
  rarity: 10,
  unlocked: false,
  unlockedAt: null,
  progress: null,
  ...over,
});
const view = (achievements: IAchievement[], fetchedAt = 1): IGameView => ({
  appid: 1,
  name: 'Game',
  total: achievements.length,
  unlockedCount: achievements.filter((a) => a.unlocked).length,
  achievements,
  fetchedAt,
  header: 'h',
});

describe('mergeView', () => {
  it('returns the previous read when only the time changed', () => {
    const before = view([
      ach('A'),
      ach('B', { progress: { current: 1, target: 5 } }),
    ]);
    const after = view(
      [ach('A'), ach('B', { progress: { current: 1, target: 5 } })],
      2,
    );
    expect(mergeView(before, after)).toBe(before);
  });

  it('replaces only the achievements that changed', () => {
    const before = view([
      ach('A'),
      ach('B'),
      ach('C', { progress: { current: 1, target: 5 } }),
    ]);
    const after = view(
      [
        ach('A'),
        ach('B', { unlocked: true, unlockedAt: 9 }),
        ach('C', { progress: { current: 2, target: 5 } }),
      ],
      2,
    );
    const merged = mergeView(before, after);
    expect(merged).not.toBe(before);
    expect(merged.unlockedCount).toBe(1);
    expect(merged.achievements[0]).toBe(before.achievements[0]);
    expect(merged.achievements[1]).toBe(after.achievements[1]);
    expect(merged.achievements[2].progress).toEqual({ current: 2, target: 5 });
  });

  it('notices new achievements, new art and a different game', () => {
    const before = view([ach('A')]);
    expect(
      mergeView(before, view([ach('A'), ach('B')])).achievements,
    ).toHaveLength(2);
    expect(
      mergeView(before, { ...view([ach('A')]), header: 'outra' }).header,
    ).toBe('outra');
    const other = { ...view([ach('A')]), appid: 2 };
    expect(mergeView(before, other)).toBe(other);
    expect(mergeView(null, before)).toBe(before);
  });
});
