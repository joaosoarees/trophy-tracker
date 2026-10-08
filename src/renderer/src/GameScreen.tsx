import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Achievement, GameUserData, GameView, GuideSite } from '../../shared/types'

type Sort = 'common' | 'rare' | 'closest' | 'name'
type Filter = 'pending' | 'unlocked'

const SORTS: Record<Sort, string> = {
  common: 'Mais comuns primeiro',
  rare: 'Mais raras primeiro',
  closest: 'Mais perto de concluir',
  name: 'Nome'
}

const GUIDES: [GuideSite, string][] = [
  ['steam', 'Guias da Steam'],
  ['youtube', 'YouTube'],
  ['google', 'Google']
]

const ratio = (a: Achievement): number => (a.progress ? a.progress.current / a.progress.target : -1)
const date = (epoch: number): string =>
  new Date(epoch * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

interface Props {
  appid: number
  running: boolean
}

export function GameScreen({ appid, running, onAuthProblem }: Props) {
  const [view, setView] = useState<GameView | null>(null)
  const [userData, setUserData] = useState<GameUserData>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [sort, setSort] = useState<Sort>('common')
  const [query, setQuery] = useState('')

  const accept = useCallback((next: GameView) => {
    const before = previous.current
    if (before) {
      const had = new Set(before.achievements.filter((a) => a.unlocked).map((a) => a.id))
      const fresh = next.achievements.filter((a) => a.unlocked && !had.has(a.id)).map((a) => a.name)
      if (fresh.length > 0) setJustUnlocked(fresh)
    }
    previous.current = next
    setView(next)
    setError(null)
  }, [])

  const load = useCallback(
    async (force: boolean) => {
      setLoading(true)
      const result = await window.api.getGame(appid, force)
      setLoading(false)
      if (result.ok) accept(result.value)
      else {
        setError(result.error)
        onAuthProblem()
      }
    },
    [appid, accept, onAuthProblem]
  )

  const list = useMemo(() => {
    if (!view) return []
    const ratio = (a: Achievement): number => {
      const p = shownProgress(a, userData[a.id])
      return p ? p.current / p.target : -1
    }
    const by: Record<Sort, (a: Achievement, b: Achievement) => number> = {
      common: (a, b) => (b.rarity ?? -1) - (a.rarity ?? -1),
      rare: (a, b) => (a.rarity ?? 101) - (b.rarity ?? 101),
      closest: (a, b) => ratio(b) - ratio(a) || (b.rarity ?? -1) - (a.rarity ?? -1),
      name: (a, b) => a.name.localeCompare(b.name, 'pt-BR')
    }
    const order =
      filter === 'unlocked' ? (a: Achievement, b: Achievement) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0) : by[sort]
    const pinned = (a: Achievement): number => (userData[a.id]?.pinned ? 1 : 0)
    return view.achievements
      .filter((a) => a.unlocked === (filter === 'unlocked') && matches(query, a.name, a.description))
      .sort((a, b) => pinned(b) - pinned(a) || order(a, b))
  }, [view, filter, sort, query, userData])

  if (!view) {
    return error ? (
      <div className="empty">
        <p className="error">{error}</p>
        <button onClick={() => void load(true)}>Tentar de novo</button>
      </div>
    ) : (
      <p className="empty">Carregando conquistas…</p>
    )
  }

  const pending = view.total - view.unlockedCount
  const percent = view.total === 0 ? 0 : Math.round((view.unlockedCount / view.total) * 100)
  const complete = view.total > 0 && pending === 0

  return (
    <section className="game">
      <header>
        <div className="title">
          <h1>{view.name}</h1>
          {running && <span className="badge live">em execução</span>}
          <button className="icon" title="Atualizar" disabled={loading} onClick={() => void load(true)}>
            {loading ? '…' : '↻'}
          </button>
        </div>
      </header>

      {justUnlocked.length > 0 && (
        <div className="toast" onClick={() => setJustUnlocked([])}>
          Conquista desbloqueada: {justUnlocked.join(', ')}
        </button>
      )}

      {view.total === 0 ? (
        <Empty>Este jogo não tem conquistas.</Empty>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'pending', label: `Pendentes ${pending}` },
                { value: 'unlocked', label: `Obtidas ${view.unlockedCount}` }
              ]}
            />
            <span className="flex-1" />
            {filter === 'pending' && (
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="bg-muted text-foreground h-8 rounded-md border px-2 text-xs"
              >
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            <div className="flex basis-full">
              <SearchBox value={query} onChange={setQuery} placeholder="Buscar conquista por nome ou descrição" />
            </div>
          </div>

          {list.length === 0 && (
            <Empty>
              {query.trim() !== ''
                ? `Nada encontrado para “${query.trim()}”.`
                : filter === 'pending'
                  ? 'Nada pendente. 100%!'
                  : 'Nenhuma conquista obtida ainda.'}
            </Empty>
          )}

          <ul className="flex flex-col gap-2">
            {list.map((a) => (
              <AchievementCard key={a.id} a={a} game={view.name} appid={appid} data={userData[a.id]} onChange={update} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
