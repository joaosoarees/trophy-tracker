import { describe, expect, it } from 'vitest';

import { makeAchievement } from '@tests/factories/makeAchievement';
import { makeGameView } from '@tests/factories/makeGameView';

import { completedAt, lastUnlockOf } from './completion';

describe('completion', () => {
  describe('lastUnlockOf', () => {
    it('should answer the latest date when several achievements are unlocked', () => {
      const view = makeGameView({
        achievements: [
          makeAchievement({ id: 'A', unlocked: true, unlockedAt: 300 }),
          makeAchievement({ id: 'B', unlocked: true, unlockedAt: 900 }),
          makeAchievement({ id: 'C' }),
        ],
      });

      const at = lastUnlockOf(view);

      expect(at).toBe(900);
    });

    it.each([
      ['nothing is unlocked', [makeAchievement({ id: 'A' })]],
      [
        'Steam dates no unlock',
        [makeAchievement({ id: 'A', unlocked: true, unlockedAt: null })],
      ],
      ['the game has no achievements', []],
    ])('should answer zero when %s', (_case, achievements) => {
      const view = makeGameView({ achievements });

      const at = lastUnlockOf(view);

      expect(at).toBe(0);
    });
  });

  describe('completedAt', () => {
    it('should answer the last unlock when nothing is left to unlock', () => {
      const game = { total: 10, unlocked: 10, lastUnlockAt: 900 };

      const at = completedAt(game);

      expect(at).toBe(900);
    });

    it.each([
      ['an achievement is left', { total: 10, unlocked: 9, lastUnlockAt: 900 }],
      [
        'Steam dates no unlock of the complete game',
        { total: 10, unlocked: 10, lastUnlockAt: 0 },
      ],
    ])('should answer no date when %s', (_case, game) => {
      const at = completedAt(game);

      expect(at).toBeNull();
    });
  });
});
