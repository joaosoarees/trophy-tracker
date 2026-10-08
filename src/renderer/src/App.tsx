import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '../../shared/types'
import { Dashboard } from './Dashboard'
import { GameScreen } from './GameScreen'
import { Onboarding } from './Onboarding'

type Tab = 'game' | 'dashboard' | 'settings'
type Current = { appid: number; running: boolean } | null

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [reconfiguring, setReconfiguring] = useState(false)
  const [tab, setTab] = useState<Tab>('game')
  const [current, setCurrent] = useState<Current>(null)
  /** Jogo escolhido no painel; vale até um jogo ser aberto na Steam. */
  const [picked, setPicked] = useState<number | null>(null)

  const refreshState = useCallback(() => window.api.getState().then(setState), [])

  useEffect(() => {
    void refreshState()
  }, [refreshState])

  useEffect(() => {
    if (!state?.configured) return
    void window.api.getCurrentAppId().then(setCurrent)
    return window.api.onGameChanged((next) => {
      setCurrent(next)
      if (next?.running) {
        setPicked(null)
        setTab('game')
      }
    })
  }, [state?.configured])

  if (!state) return null

  if (!state.configured || reconfiguring) {
    return (
      <Onboarding
        notice={state.configError}
        onCancel={reconfiguring && state.configured ? () => setReconfiguring(false) : undefined}
        onDone={(next) => {
          setReconfiguring(false)
          setState(next)
        }}
      />
    )
  }

  const appid = picked ?? current?.appid ?? null
  const running = current?.running === true && appid === current.appid

  return (
    <div className="app">
      <nav className="tabs">
        <button className={tab === 'game' ? 'active' : ''} onClick={() => setTab('game')}>
          Jogo
        </button>
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
          Painel
        </button>
        <span className="spacer" />
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          Configuração
        </button>
      </nav>

      {tab === 'game' &&
        (appid === null ? (
          <p className="empty">Nenhum jogo aberto e nenhum jogo jogado ainda. Escolha um no Painel.</p>
        ) : (
          <GameScreen key={appid} appid={appid} running={running} onAuthProblem={refreshState} />
        ))}

      {tab === 'dashboard' && (
        <Dashboard
          onAuthProblem={refreshState}
          onPick={(id) => {
            setPicked(id)
            setTab('game')
          }}
        />
      )}

      {tab === 'settings' && (
        <section className="settings">
          {state.profile && (
            <div className="profile">
              {state.profile.avatar && <img src={state.profile.avatar} alt="" />}
              <div>
                <strong>{state.profile.name}</strong>
                <small>SteamID {state.profile.steamId}</small>
              </div>
            </div>
          )}
          <button onClick={() => setReconfiguring(true)}>Refazer a configuração</button>
          <button
            className="danger"
            onClick={() => {
              if (confirm('Apagar a chave e o SteamID salvos? Suas notas são mantidas.')) {
                void window.api.resetConfig().then(setState)
              }
            }}
          >
            Apagar chave e SteamID
          </button>
        </section>
      )}
    </div>
  )
}
