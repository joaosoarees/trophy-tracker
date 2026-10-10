import { describe, expect, it } from 'vitest';

import { type IGameView } from '@shared/types/Game';
import { makeAchievement } from '@tests/factories/makeAchievement';
import { makeGameView } from '@tests/factories/makeGameView';

import { gameDetailsOf } from './gameDetails';

/** Four pending achievements, one of unknown rarity, and two unlocked. */
const makeGame = (): IGameView =>
  makeGameView({
    achievements: [
      makeAchievement({ id: 'common', rarity: 80 }),
      makeAchievement({ id: 'rare', rarity: 2 }),
      makeAchievement({ id: 'middle', rarity: 40 }),
      makeAchievement({ id: 'unrated' }),
      makeAchievement({
        id: 'old',
        unlocked: true,
        unlockedAt: 100,
        rarity: 99,
      }),
      makeAchievement({
        id: 'new',
        unlocked: true,
        unlockedAt: 900,
        rarity: 1,
      }),
    ],
  });

describe('gameDetailsOf', () => {
  it('should name the pending achievement most players have as the easiest', () => {
    const game = makeGame();

    const details = gameDetailsOf(game, {});

    expect(details.easiest?.id).toBe('common');
  });

  it('should name the pending achievement fewest players have as the rarest', () => {
    const game = makeGame();

    const details = gameDetailsOf(game, {});

    expect(details.rarest?.id).toBe('rare');
  });

  it('should not name a rarest when it would be the easiest again', () => {
    const only = makeAchievement({ id: 'only', rarity: 10 });
    const game = makeGameView({ achievements: [only] });

    const details = gameDetailsOf(game, {});

    expect(details).toEqual({
      lastUnlocked: null,
      easiest: only,
      rarest: null,
      closest: null,
    });
  });

  it('should name the achievement unlocked most recently', () => {
    const game = makeGame();

    const details = gameDetailsOf(game, {});

    expect(details.lastUnlocked?.id).toBe('new');
  });

  it('should name nothing unlocked last when Steam reports no dates', () => {
    const game = makeGameView({
      achievements: [makeAchievement({ unlocked: true })],
    });

    const details = gameDetailsOf(game, {});

    expect(details.lastUnlocked).toBeNull();
  });

  it('should name the pending achievement whose counter is furthest along', () => {
    const late = makeAchievement({
      id: 'late',
      progress: { current: 9, target: 10 },
    });
    const game = makeGameView({
      achievements: [
        makeAchievement({ id: 'early', progress: { current: 1, target: 10 } }),
        late,
        makeAchievement({ id: 'none' }),
      ],
    });

    const details = gameDetailsOf(game, {});

    expect(details.closest).toMatchObject({
      achievement: late,
      current: 9,
      target: 10,
    });
  });

  it("should count the user's own checklist as a counter", () => {
    const listed = makeAchievement({ id: 'a' });
    const game = makeGameView({ achievements: [listed] });
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

    const details = gameDetailsOf(game, userData);

    expect(details.closest).toMatchObject({
      achievement: listed,
      current: 1,
      target: 2,
    });
  });

  it('should name nothing as closest when no counter has moved', () => {
    const game = makeGameView({
      achievements: [makeAchievement({ progress: { current: 0, target: 10 } })],
    });

    const details = gameDetailsOf(game, {});

    expect(details.closest).toBeNull();
  });

  it('should have nothing to say about what is left when the game is finished', () => {
    const last = makeAchievement({ unlocked: true, unlockedAt: 5 });
    const game = makeGameView({ achievements: [last] });

    const details = gameDetailsOf(game, {});

    expect(details).toEqual({
      lastUnlocked: last,
      easiest: null,
      rarest: null,
      closest: null,
    });
  });
});
