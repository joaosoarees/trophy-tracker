/** The two lists of the dashboard. */
export type DashboardFilter = 'ongoing' | 'complete';

export const ONGOING_SORTS = ['closest', 'played', 'fewest', 'name'] as const;
export const COMPLETE_SORTS = ['completed', 'played', 'name'] as const;

export type OngoingSort = (typeof ONGOING_SORTS)[number];
export type CompleteSort = (typeof COMPLETE_SORTS)[number];
export type DashboardSort = OngoingSort | CompleteSort;

/** The order chosen for each list; a preference kept across restarts. */
export interface IDashboardSort {
  ongoing: OngoingSort;
  complete: CompleteSort;
}

export const DEFAULT_DASHBOARD_SORT: IDashboardSort = {
  ongoing: 'closest',
  complete: 'completed',
};

export const DASHBOARD_SORTS_BY_FILTER = {
  ongoing: ONGOING_SORTS,
  complete: COMPLETE_SORTS,
} as const;

const includes = <T extends string>(
  options: readonly T[],
  value: unknown,
): value is T => options.includes(value as T);

/** Reads a stored preference, falling back to the default for anything invalid. */
export function parseDashboardSort(value: unknown): IDashboardSort {
  const stored = (value ?? {}) as Partial<Record<DashboardFilter, unknown>>;

  return {
    ongoing: includes(ONGOING_SORTS, stored.ongoing)
      ? stored.ongoing
      : DEFAULT_DASHBOARD_SORT.ongoing,
    complete: includes(COMPLETE_SORTS, stored.complete)
      ? stored.complete
      : DEFAULT_DASHBOARD_SORT.complete,
  };
}

export const isDashboardFilter = (value: unknown): value is DashboardFilter =>
  value === 'ongoing' || value === 'complete';
