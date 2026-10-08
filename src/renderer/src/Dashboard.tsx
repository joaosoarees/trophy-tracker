import { useCallback, useEffect, useState } from 'react'
import type { GameSummary } from '../../shared/types'

interface Props {
  onPick(appid: number): void
  onAuthProblem(): void
}

export function Dashboard({ onPick, onAuthProblem }: Props) {
  const [games, setGames] = useState<GameSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<[number, number] | null>(null)

  const load = useCallback(
    async (force: boolean) => {
      setLoading(true)
      setProgress(null)
      const result = await window.api.getDashboard(force)
      setLoading(false)
      if (result.ok) {
        setGames(result.value)
        setError(null)
      } else {
        setError(result.error)
        onAuthProblem()
      }
    },
    [onAuthProblem]
  )

  useEffect(() => {
    void load(false)
    return window.api.onDashboardProgress((done, total) => setProgress([done, total]))
  }, [load])

  const incomplete = games?.filter((g) => g.unlocked < g.total).length ?? 0

  return (
    <section className="dashboard">
      <header>
        <div className="title">
          <h1>Painel</h1>
          <button className="icon" title="Atualizar tudo" disabled={loading} onClick={() => void load(true)}>
            {loading ? '…' : '↻'}
          </button>
        </div>
        {loading && (
          <p className="muted">
            {progress ? `Lendo conquistas: ${progress[0]} de ${progress[1]} jogos…` : 'Carregando sua biblioteca…'}
          </p>
        )}
        {!loading && games && (
          <p className="muted">
            {games.length} jogos com conquistas · {games.length - incomplete} completos · {incomplete} em andamento
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </header>

      {games && games.length === 0 && !loading && <p className="empty">Nenhum jogo jogado com conquistas.</p>}

      <ul className="games">
        {games?.map((g) => {
          const percent = Math.round((g.unlocked / g.total) * 100)
          return (
            <li key={g.appid} className={g.unlocked === g.total ? 'complete' : ''} onClick={() => onPick(g.appid)}>
              {g.icon ? <img src={g.icon} alt="" loading="lazy" /> : <span className="noicon" />}
              <div className="body">
                <strong>{g.name}</strong>
                <div className="bar">
                  <div style={{ width: `${percent}%` }} />
                </div>
              </div>
              <div className="count">
                <strong>{percent}%</strong>
                <small>{g.unlocked === g.total ? 'completo' : `faltam ${g.total - g.unlocked}`}</small>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
