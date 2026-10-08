import type { StoreSlice } from '@app/store/Store';
import type { DashboardMode, IGameSummary } from '@shared/types';

type DashboardStore = {
  games: IGameSummary[] | null;
  loading: boolean;
  error: string | null;
  /** Games read and total, during a load. */
  progress: [number, number] | null;
};

type DashboardActions = {
  load: (mode?: DashboardMode) => Promise<void>;
  setProgress: (done: number, total: number) => void;
};

export type DashboardSlice = DashboardStore & DashboardActions;

export const createDashboardSlice: StoreSlice<DashboardSlice> = (set, get) => ({
  games: null,
  loading: false,
  error: null,
  progress: null,

  load: async (mode = 'cached') => {
    if (get().dashboard.loading) return;
    set(
      (prevState) => {
        prevState.dashboard.loading = true;
        prevState.dashboard.progress = null;
      },
      false,
      'dashboard/load',
    );

    const result = await window.api.getDashboard(mode);
    set(
      (prevState) => {
        prevState.dashboard.loading = false;
        prevState.dashboard.progress = null;
        if (result.ok) {
          prevState.dashboard.games = result.value;
          prevState.dashboard.error = null;
        } else {
          prevState.dashboard.error = result.error;
        }
      },
      false,
      result.ok ? 'dashboard/loaded' : 'dashboard/loadFailed',
    );
    if (!result.ok) get().session.reportFailure();
  },

  setProgress: (done, total) =>
    set(
      (prevState) => {
        prevState.dashboard.progress = [done, total];
      },
      false,
      'dashboard/setProgress',
    ),
});
