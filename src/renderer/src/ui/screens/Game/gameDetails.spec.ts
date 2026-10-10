import { describe, expect, it } from 'vitest';

import { makeAchievement } from '@test/factories/makeAchievement';
import { makeGameView } from '@test/factories/makeGameView';
import { gameDetailsOf } from '@ui/screens/Game/gameDetails';

const game = makeGameView({
  achievements: [
    makeAchievement({ id: 'common', rarity: 80 }),
    makeAchievement({ id: 'rare', rarity: 2 }),
    makeAchievement({ id: 'middle', rarity: 40 }),
    makeAchievement({ id: 'unrated' }),
    makeAchievement({ id: 'old', unlocked: true, unlockedAt: 100, rarity: 99 }),
    makeAchievement({ id: 'new', unlocked: true, unlockedAt: 900, rarity: 1 }),
  ],
});

describe('gameDetailsOf', () => {
  it('names the pending achievement most players have as the easiest', () => {
    expect(gameDetailsOf(game, {}).easiest?.id).toBe('common');
  });

  it('names the pending achievement fewest players have as the rarest', () => {
    expect(gameDetailsOf(game, {}).rarest?.id).toBe('rare');
  });

  it('does not name a rarest when it would be the easiest again', () => {
    const one = makeGameView({
      achievements: [makeAchievement({ id: 'only', rarity: 10 })],
    });

    expect(gameDetailsOf(one, {})).toMatchObject({
      easiest: { id: 'only' },
      rarest: null,
    });
  });

  it('names the achievement unlocked most recently', () => {
    expect(gameDetailsOf(game, {}).lastUnlocked?.id).toBe('new');
  });

  it('names nothing unlocked last when Steam reports no dates', () => {
    const undated = makeGameView({
      achievements: [makeAchievement({ unlocked: true })],
    });

    expect(gameDetailsOf(undated, {}).lastUnlocked).toBeNull();
  });

  it('names the pending achievement whose counter is furthest along', () => {
    const counted = makeGameView({
      achievements: [
        makeAchievement({ id: 'early', progress: { current: 1, target: 10 } }),
        makeAchievement({ id: 'late', progress: { current: 9, target: 10 } }),
        makeAchievement({ id: 'none' }),
      ],
    });

    expect(gameDetailsOf(counted, {}).closest).toMatchObject({
      achievement: { id: 'late' },
      current: 9,
      target: 10,
    });
  });

  it("counts the user's own checklist as a counter", () => {
    const listed = makeGameView({
      achievements: [makeAchievement({ id: 'a' })],
    });
    const userData = {
      a: {
        note: '',
        pinned: false,
        checklist: [
          { id: '1', text: 'Bridge', done: true },
          { id: '2', text: 'Cave', done: false },
        ],
      },
    };

    expect(gameDetailsOf(listed, userData).closest).toMatchObject({
      current: 1,
      target: 2,
    });
  });

  it('names nothing as closest when no counter has moved', () => {
    const untouched = makeGameView({
      achievements: [makeAchievement({ progress: { current: 0, target: 10 } })],
    });

    expect(gameDetailsOf(untouched, {}).closest).toBeNull();
  });

  it('has nothing to say about what is left in a finished game', () => {
    const done = makeGameView({
      achievements: [makeAchievement({ unlocked: true, unlockedAt: 5 })],
    });

    expect(gameDetailsOf(done, {})).toMatchObject({
      easiest: null,
      rarest: null,
      closest: null,
    });
  });
});
