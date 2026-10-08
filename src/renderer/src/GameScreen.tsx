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
  onAuthProblem(): void
}

export function GameScreen({ appid, running, onAuthProblem }: Props) {
  const [view, setView] = useState<GameView | null>(null)
  const [userData, setUserData] = useState<GameUserData>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [sort, setSort] = useState<Sort>('common')
  const [justUnlocked, setJustUnlocked] = useState<string[]>([])
  const previous = useRef<GameView | null>(null)

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

  useEffect(() => {
    void load(false)
    void window.api.getUserData(appid).then(setUserData)
    return window.api.onGameUpdated((next) => {
      if (next.appid === appid) accept(next)
    })
  }, [appid, load, accept])

  const update = (id: string, patch: Partial<GameUserData[string]>): void => {
    const next = { ...(userData[id] ?? { note: '', pinned: false }), ...patch }
    setUserData({ ...userData, [id]: next })
    void window.api.setUserData(appid, id, next)
  }

  const list = useMemo(() => {
    if (!view) return []
    const items = view.achievements.filter((a) => a.unlocked === (filter === 'unlocked'))
    const by: Record<Sort, (a: Achievement, b: Achievement) => number> = {
      common: (a, b) => (b.rarity ?? -1) - (a.rarity ?? -1),
      rare: (a, b) => (a.rarity ?? 101) - (b.rarity ?? 101),
      closest: (a, b) => ratio(b) - ratio(a) || (b.rarity ?? -1) - (a.rarity ?? -1),
      name: (a, b) => a.name.localeCompare(b.name, 'pt-BR')
    }
    const order = filter === 'unlocked' ? (a: Achievement, b: Achievement) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0) : by[sort]
    const pinned = (a: Achievement): number => (userData[a.id]?.pinned ? 1 : 0)
    return items.sort((a, b) => pinned(b) - pinned(a) || order(a, b))
  }, [view, filter, sort, userData])

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
        <div className="bar big">
          <div style={{ width: `${percent}%` }} />
        </div>
        <p className="muted">
          {view.unlockedCount} de {view.total} conquistas · {percent}%
          {pending > 0 ? ` · faltam ${pending}` : view.total > 0 ? ' · todas obtidas' : ''}
        </p>
        {error && <p className="error">{error}</p>}
      </header>

      {justUnlocked.length > 0 && (
        <div className="toast" onClick={() => setJustUnlocked([])}>
          Conquista desbloqueada: {justUnlocked.join(', ')}
        </div>
      )}

      {view.total === 0 ? (
        <p className="empty">Este jogo não tem conquistas.</p>
      ) : (
        <>
          <div className="toolbar">
            <div className="segmented">
              <button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>
                Pendentes ({pending})
              </button>
              <button className={filter === 'unlocked' ? 'active' : ''} onClick={() => setFilter('unlocked')}>
                Desbloqueadas ({view.unlockedCount})
              </button>
            </div>
            {filter === 'pending' && (
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {list.length === 0 && (
            <p className="empty">{filter === 'pending' ? 'Nada pendente. 100%!' : 'Nenhuma conquista desbloqueada ainda.'}</p>
          )}

          <ul className="achievements">
            {list.map((a) => (
              <Card
                key={a.id}
                a={a}
                game={view.name}
                appid={appid}
                data={userData[a.id]}
                onChange={(patch) => update(a.id, patch)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

interface CardProps {
  a: Achievement
  game: string
  appid: number
  data: GameUserData[string] | undefined
  onChange(patch: Partial<GameUserData[string]>): void
}

function Card({ a, game, appid, data, onChange }: CardProps) {
  const [noteOpen, setNoteOpen] = useState(false)
  const pinned = data?.pinned === true
  const note = data?.note ?? ''
  const showNote = noteOpen || note !== ''

  return (
    <li className={`card${pinned ? ' pinned' : ''}${a.unlocked ? ' unlocked' : ''}`}>
      <img src={a.unlocked ? a.icon : a.iconGray || a.icon} alt="" loading="lazy" />
      <div className="body">
        <div className="name">
          <strong>{a.name}</strong>
          {a.hidden && <span className="badge">oculta</span>}
          {a.rarity !== null && (
            <span className="rarity" title="Jogadores que têm esta conquista">
              {a.rarity.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </span>
          )}
        </div>
        <p>{a.description || 'Sem descrição.'}</p>

        {a.progress && !a.unlocked && (
          <div className="progress">
            <div className="bar">
              <div style={{ width: `${(a.progress.current / a.progress.target) * 100}%` }} />
            </div>
            <span>
              {a.progress.current.toLocaleString('pt-BR')} / {a.progress.target.toLocaleString('pt-BR')}
            </span>
          </div>
        )}

        {a.unlocked ? (
          a.unlockedAt && <small className="muted">Obtida em {date(a.unlockedAt)}</small>
        ) : (
          <div className="links">
            {GUIDES.map(([site, label]) => (
              <button key={site} onClick={() => void window.api.openGuide(site, appid, game, a.name)}>
                {label}
              </button>
            ))}
            <span className="spacer" />
            {!showNote && <button onClick={() => setNoteOpen(true)}>Nota</button>}
            <button className={pinned ? 'active' : ''} title="Fixar no topo" onClick={() => onChange({ pinned: !pinned })}>
              {pinned ? 'Fixada' : 'Fixar'}
            </button>
          </div>
        )}

        {showNote && (
          <textarea
            value={note}
            rows={2}
            autoFocus={noteOpen && note === ''}
            placeholder="Sua anotação ou um link de guia"
            onChange={(e) => onChange({ note: e.target.value })}
            onBlur={() => setNoteOpen(false)}
          />
        )}
      </div>
    </li>
  )
}
