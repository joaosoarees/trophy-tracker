import type { GameView } from '../../../../shared/types'
import { mergeView } from '../../../../shared/view'
import type { StoreSlice } from '../Store'

export type GameEntry = {
  view: GameView | null
  loading: boolean
  error: string | null
  /** Nomes das conquistas obtidas desde a última leitura, até o aviso ser dispensado. */
  justUnlocked: string[]
}

type GamesStore = {
  entries: Record<number, GameEntry>
}

type GamesActions = {
  /** Garante que a tela de um jogo tem dados; o que já foi lido aparece na hora. */
  open: (appid: number) => void
  load: (appid: number, force?: boolean) => Promise<void>
  /** Recebe uma leitura nova, reaproveitando o que não mudou. */
  accept: (view: GameView) => void
  dismissUnlocked: (appid: number) => void
}

export type GamesSlice = GamesStore & GamesActions

const emptyEntry = (): GameEntry => ({ view: null, loading: false, error: null, justUnlocked: [] })

export const createGamesSlice: StoreSlice<GamesSlice> = (set, get) => ({
  entries: {},

  open: (appid) => {
    if (!get().games.entries[appid]?.view) void get().games.load(appid)
    void get().userData.load(appid)
  },

  load: async (appid, force = false) => {
    if (get().games.entries[appid]?.loading) return
    set(
      (prevState) => {
        ;(prevState.games.entries[appid] ??= emptyEntry()).loading = true
      },
      false,
      'games/load'
    )

    const result = await window.api.getGame(appid, force)
    if (result.ok) return get().games.accept(result.value)

    set(
      (prevState) => {
        const entry = prevState.games.entries[appid]
        entry.loading = false
        entry.error = result.error
      },
      false,
      'games/loadFailed'
    )
    get().session.reportFailure()
  },

  accept: (next) =>
    set(
      (prevState) => {
        const entry = (prevState.games.entries[next.appid] ??= emptyEntry())
        const previous = get().games.entries[next.appid]?.view ?? null
        const view = mergeView(previous, next)
        entry.loading = false
        entry.error = null
        if (view === previous) return

        if (previous) {
          const had = new Set(previous.achievements.filter((a) => a.unlocked).map((a) => a.id))
          entry.justUnlocked.push(...view.achievements.filter((a) => a.unlocked && !had.has(a.id)).map((a) => a.name))
        }
        entry.view = view

        // Mantém a linha do painel em dia sem reler o painel.
        const row = prevState.dashboard.games?.find((g) => g.appid === view.appid)
        if (row) {
          row.unlocked = view.unlockedCount
          row.total = view.total
        }
      },
      false,
      'games/accept'
    ),

  dismissUnlocked: (appid) =>
    set(
      (prevState) => {
        const entry = prevState.games.entries[appid]
        if (entry) entry.justUnlocked = []
      },
      false,
      'games/dismissUnlocked'
    )
})
