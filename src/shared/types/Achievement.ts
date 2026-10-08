export interface IAchievement {
  id: string;
  name: string;
  description: string;
  hidden: boolean;
  icon: string;
  iconGray: string;
  /** Global percentage of players who have the achievement. */
  rarity: number | null;
  unlocked: boolean;
  /** Epoch in seconds. */
  unlockedAt: number | null;
  progress: { current: number; target: number } | null;
}
