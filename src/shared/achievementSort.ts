/** The two lists of a game screen. */
export type AchievementFilter = 'pending' | 'unlocked';

export const PENDING_SORTS = ['common', 'rare', 'closest', 'name'] as const;
export const UNLOCKED_SORTS = [
  'recent',
  'oldest',
  'rare',
  'common',
  'name',
] as const;

export type PendingSort = (typeof PENDING_SORTS)[number];
export type UnlockedSort = (typeof UNLOCKED_SORTS)[number];
export type AchievementSort = PendingSort | UnlockedSort;

/** The order chosen for each list; a preference kept across games and restarts. */
export interface IAchievementSort {
  pending: PendingSort;
  unlocked: UnlockedSort;
}

export const DEFAULT_ACHIEVEMENT_SORT: IAchievementSort = {
  pending: 'common',
  unlocked: 'recent',
};

export const SORTS_BY_FILTER = {
  pending: PENDING_SORTS,
  unlocked: UNLOCKED_SORTS,
} as const;

const includes = <T extends string>(
  options: readonly T[],
  value: unknown,
): value is T => options.includes(value as T);

/** Reads a stored preference, falling back to the default for anything invalid. */
export function parseAchievementSort(value: unknown): IAchievementSort {
  const stored = (value ?? {}) as Partial<Record<AchievementFilter, unknown>>;

  return {
    pending: includes(PENDING_SORTS, stored.pending)
      ? stored.pending
      : DEFAULT_ACHIEVEMENT_SORT.pending,
    unlocked: includes(UNLOCKED_SORTS, stored.unlocked)
      ? stored.unlocked
      : DEFAULT_ACHIEVEMENT_SORT.unlocked,
  };
}

export const isAchievementFilter = (
  value: unknown,
): value is AchievementFilter => value === 'pending' || value === 'unlocked';
