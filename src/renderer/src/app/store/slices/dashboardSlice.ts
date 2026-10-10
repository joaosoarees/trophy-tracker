import { DashboardService } from '@app/services/DashboardService';
import { sameAccount } from '@app/store/sameAccount';
import type { StoreSlice } from '@app/store/Store';
import { type DashboardMode, type IGameSummary } from '@shared/types/Game';

type DashboardStore = {
  games: IGameSummary[] | null;
  isLoading: boolean;
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
  isLoading: false,
  error: null,
  progress: null,

  load: async (mode = 'cached') => {
    if (get().dashboard.isLoading) return;
    set(
      (prevState) => {
        prevState.dashboard.isLoading = true;
        prevState.dashboard.progress = null;
      },
      false,
      'dashboard/load',
    );

    const isSameAccount = sameAccount(get);
    const result = await DashboardService.getDashboard(mode);
    // Another account's dashboard is being read by now: it owns `isLoading`.
    if (!isSameAccount()) return;
    set(
      (prevState) => {
        prevState.dashboard.isLoading = false;
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
