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
  /**
   * The read asked for while another one was running, which that one cannot
   * stand for: it took the library before this was asked. It runs when the
   * one in flight ends, or with the next read when that one failed.
   */
  queued: DashboardMode | null;
};

type DashboardActions = {
  load: (mode?: DashboardMode) => Promise<void>;
  setProgress: (done: number, total: number) => void;
};

export type DashboardSlice = DashboardStore & DashboardActions;

/** From the read that asks the least of Steam to the one that asks the most. */
const MODES: DashboardMode[] = ['cached', 'changed', 'all'];

const stronger = (a: DashboardMode, b: DashboardMode): DashboardMode =>
  MODES.indexOf(a) >= MODES.indexOf(b) ? a : b;

export const createDashboardSlice: StoreSlice<DashboardSlice> = (set, get) => ({
  games: null,
  isLoading: false,
  error: null,
  progress: null,
  queued: null,

  load: async (mode = 'cached') => {
    if (get().dashboard.isLoading) {
      // One read at a time: the main process would run a second one beside
      // the first. What the one in flight already has is all `cached` asks.
      if (mode === 'cached') return;
      set(
        (prevState) => {
          prevState.dashboard.queued = stronger(
            prevState.dashboard.queued ?? mode,
            mode,
          );
        },
        false,
        'dashboard/queue',
      );
      return;
    }
    const asked = stronger(get().dashboard.queued ?? mode, mode);
    set(
      (prevState) => {
        prevState.dashboard.isLoading = true;
        prevState.dashboard.progress = null;
        prevState.dashboard.queued = null;
      },
      false,
      'dashboard/load',
    );

    const isSameAccount = sameAccount(get);
    const result = await DashboardService.getDashboard(asked);
    // The store was wired again since, for another account or for this one:
    // the read asked then owns `isLoading`.
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
    // After a failure nothing is asked again by itself: what is queued goes
    // with the next read.
    if (result.ok && get().dashboard.queued) await get().dashboard.load();
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
