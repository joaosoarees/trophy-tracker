import { type IGameView } from './types/Game';

/**
 * When a game was completed, by the one rule both sides follow: the main
 * process as it lists the dashboard, the interface as it brings a dashboard
 * row up to date from a game it has just read. A date worked out anywhere
 * else would change at the next read of the dashboard.
 */

/** When the last achievement of a read was unlocked (epoch in seconds); zero when Steam dates none. */
export function lastUnlockOf(view: IGameView): number {
  return Math.max(0, ...view.achievements.map((a) => a.unlockedAt ?? 0));
}

/**
 * The last unlock of a game with nothing left to unlock; `null` while
 * something is left, and when Steam dates no unlock.
 */
export function completedAt(game: {
  total: number;
  unlocked: number;
  lastUnlockAt: number;
}): number | null {
  return game.unlocked === game.total && game.lastUnlockAt
    ? game.lastUnlockAt
    : null;
}
