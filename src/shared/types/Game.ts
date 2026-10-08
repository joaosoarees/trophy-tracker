import { type IAchievement } from './Achievement';

export interface IGameView {
  appid: number;
  name: string;
  total: number;
  unlockedCount: number;
  achievements: IAchievement[];
  fetchedAt: number;
  /** Wide game art; empty when the store does not report it. */
  header?: string;
}

export interface IGameSummary {
  appid: number;
  name: string;
  icon: string;
  /** Small capsule art; empty when the store does not report it. */
  capsule: string;
  playtimeMinutes: number;
  lastPlayed: number;
  total: number;
  unlocked: number;
  /** When the last achievement was unlocked (epoch in seconds); `null` unless the game is complete. */
  completedAt: number | null;
}

/** Game on screen by default: the one open on Steam or, with none open, the last one played. */
export type CurrentGame = { appid: number; running: boolean } | null;

/** `cached`: uses what it already has; `changed`: re-reads the library and only the games that changed; `all`: re-reads everything. */
export type DashboardMode = 'cached' | 'changed' | 'all';
