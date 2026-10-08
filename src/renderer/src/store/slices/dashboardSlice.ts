import type { DashboardMode, GameSummary } from '../../../../shared/types'
import type { StoreSlice } from '../Store'

type DashboardStore = {
  games: GameSummary[] | null
  loading: boolean
  error: string | null
  /** Jogos lidos e total, durante uma carga. */
  progress: [number, number] | null
}

type DashboardActions = {
  load: (mode?: DashboardMode) => Promise<void>
  setProgress: (done: number, total: number) => void
}

export type DashboardSlice = DashboardStore & DashboardActions

export const createDashboardSlice: StoreSlice<DashboardSlice> = (set, get) => ({
  games: null,
  loading: false,
  error: null,
  progress: null,

  load: async (mode = 'cached') => {
    if (get().dashboard.loading) return
    set(
      (prevState) => {
        prevState.dashboard.loading = true
        prevState.dashboard.progress = null
      },
      false,
      'dashboard/load'
    )

    const result = await window.api.getDashboard(mode)
    set(
      (prevState) => {
        prevState.dashboard.loading = false
        prevState.dashboard.progress = null
        if (result.ok) {
          prevState.dashboard.games = result.value
          prevState.dashboard.error = null
        } else {
          prevState.dashboard.error = result.error
        }
      },
      false,
      result.ok ? 'dashboard/loaded' : 'dashboard/loadFailed'
    )
    if (!result.ok) get().session.reportFailure()
  },

  setProgress: (done, total) =>
    set(
      (prevState) => {
        prevState.dashboard.progress = [done, total]
      },
      false,
      'dashboard/setProgress'
    )
})
