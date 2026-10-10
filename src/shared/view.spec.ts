import { describe, expect, it } from 'vitest';

import { makeAchievement } from '@tests/factories/makeAchievement';
import { makeGameView } from '@tests/factories/makeGameView';

import { type IAchievement } from './types/Achievement';
import { mergeView } from './view';

const ach = (id: string, over: Partial<IAchievement> = {}) =>
  makeAchievement({ id, rarity: 10, ...over });

/** A read of game 1, with its art; a later read has a later `fetchedAt`. */
const view = (achievements: IAchievement[], fetchedAt = 1) =>
  makeGameView({ achievements, fetchedAt, header: 'h' });

describe('view', () => {
  describe('mergeView', () => {
    it('should return the previous read when only the time changed', () => {
      const before = view([
        ach('A'),
        ach('B', { progress: { current: 1, target: 5 } }),
      ]);
      const after = view(
        [ach('A'), ach('B', { progress: { current: 1, target: 5 } })],
        2,
      );

      const merged = mergeView(before, after);

      expect(merged).toBe(before);
    });

    it('should answer what the new read says when an achievement changed', () => {
      const before = view([ach('A'), ach('B')]);
      const after = view(
        [ach('A'), ach('B', { unlocked: true, unlockedAt: 9 })],
        2,
      );

      const merged = mergeView(before, after);

      expect(merged).toEqual(after);
    });

    it('should answer the achievements in the order of the new read when they only changed places', () => {
      const before = view([ach('A'), ach('B')]);
      const after = view([ach('B'), ach('A')], 2);

      const merged = mergeView(before, after);

      expect(merged.achievements.map((a) => a.id)).toEqual(['B', 'A']);
    });

    it('should reuse the achievements when they only changed places', () => {
      const before = view([ach('A'), ach('B')]);
      const after = view([ach('B'), ach('A')], 2);

      const merged = mergeView(before, after);

      expect(merged.achievements[0]).toBe(before.achievements[1]);
    });

    it('should reuse the achievement that did not change when another one did', () => {
      const before = view([ach('A'), ach('B')]);
      const after = view(
        [ach('A'), ach('B', { unlocked: true, unlockedAt: 9 })],
        2,
      );

      const merged = mergeView(before, after);

      expect(merged.achievements[0]).toBe(before.achievements[0]);
    });

    it.each([
      { change: 'it was unlocked', over: { unlocked: true, unlockedAt: 9 } },
      {
        change: 'its counter moved',
        over: { progress: { current: 2, target: 5 } },
      },
    ])(
      'should take the achievement from the new read when $change',
      ({ over }) => {
        const progress = { current: 1, target: 5 };
        const before = view([ach('A', { progress })]);
        const after = view([ach('A', { progress, ...over })], 2);

        const merged = mergeView(before, after);

        expect(merged.achievements[0]).toBe(after.achievements[0]);
      },
    );

    it('should include the new achievement when the new read has one more', () => {
      const before = view([ach('A')]);
      const after = view([ach('A'), ach('B')], 2);

      const merged = mergeView(before, after);

      expect(merged).toEqual(after);
    });

    it('should answer the new art when only the art changed', () => {
      const before = view([ach('A')]);
      const after = { ...view([ach('A')], 2), header: 'other' };

      const merged = mergeView(before, after);

      expect(merged).toEqual(after);
    });

    it('should return the new read when it is of another game', () => {
      const before = view([ach('A')]);
      const other = { ...view([ach('A')]), appid: 2 };

      const merged = mergeView(before, other);

      expect(merged).toBe(other);
    });

    it('should return the new read when there is no previous one', () => {
      const next = view([ach('A')]);

      const merged = mergeView(null, next);

      expect(merged).toBe(next);
    });
  });
});
