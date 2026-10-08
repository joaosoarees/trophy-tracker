import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '../../shared/types'
import { Dashboard } from './Dashboard'
import { GameScreen } from './GameScreen'
import { Onboarding } from './Onboarding'

type Tab = 'game' | 'dashboard' | 'settings'

function TabButton({ active, onClick, children }: { active: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        '-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pt-2 pb-2 text-sm font-medium transition-colors [&_svg]:size-4',
        active ? 'border-primary text-foreground' : 'text-muted-foreground hover:text-foreground border-transparent'
      )}
    >
      {children}
    </button>
  )
}

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [reconfiguring, setReconfiguring] = useState(false)
  const [tab, setTab] = useState<Tab>('game')
  const [current, setCurrent] = useState<Current>(null)
  /** Jogo escolhido no painel; vale até um jogo ser aberto na Steam. */
  const [picked, setPicked] = useState<number | null>(null)
  const [onTop, setOnTop] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const refreshState = useCallback(() => window.api.getState().then(setState), [])

  useEffect(() => {
    void refreshState()
    void window.api.getAlwaysOnTop().then(setOnTop)
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
    <div className="flex h-screen flex-col">
      <nav className="flex items-center gap-1 border-b px-2">
        <TabButton active={tab === 'game'} onClick={() => setTab('game')}>
          <Trophy />
          Jogo
        </TabButton>
        <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')}>
          <LayoutGrid />
          Painel
        </TabButton>
        <span className="flex-1" />
        <Button
          size="icon-sm"
          variant="ghost"
          title={onTop ? 'Deixar de manter a janela no topo' : 'Manter a janela sempre no topo'}
          className={cn(onTop && 'text-primary hover:text-primary')}
          onClick={() => void window.api.setAlwaysOnTop(!onTop).then(setOnTop)}
        >
          <Pin className={cn(onTop && 'fill-current')} />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Configuração"
          className={cn(tab === 'settings' && 'text-primary hover:text-primary')}
          onClick={() => setTab('settings')}
        >
          <Settings />
        </Button>
      </nav>

      {tab === 'game' &&
        (appid === null ? (
          <p className="empty">Nenhum jogo aberto e nenhum jogo jogado ainda. Escolha um no Painel.</p>
        ) : (
          <GameScreen key={appid} appid={appid} running={running} />
        )}
      </div>

      {tab === 'dashboard' && (
        <Dashboard
          onPick={(id) => {
            setPicked(id)
            setTab('game')
          }}
        />
      </div>

      {tab === 'settings' && (
        <section className="flex flex-1 flex-col items-start gap-3 overflow-y-auto p-4">
          <h1 className="text-xl font-semibold">Configuração</h1>
          {state.profile && (
            <div className="bg-card flex w-full items-center gap-3 rounded-lg border p-3">
              {state.profile.avatar && <img src={state.profile.avatar} alt="" className="size-12 rounded-md" />}
              <div>
                <strong className="block">{state.profile.name || 'Conta Steam'}</strong>
                <small className="text-muted-foreground">SteamID {state.profile.steamId}</small>
              </div>
            </div>
          )}
          <Button variant="secondary" onClick={() => setReconfiguring(true)}>
            Refazer a configuração
          </Button>
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmingReset(true)}>
            Apagar chave e SteamID
          </Button>

          <Dialog open={confirmingReset} onOpenChange={setConfirmingReset}>
            <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))]">
              <DialogHeader>
                <DialogTitle>Apagar chave e SteamID?</DialogTitle>
                <DialogDescription>
                  O app volta para a configuração inicial. Suas notas, checklists e conquistas fixadas são mantidas.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirmingReset(false)
                    void window.api.resetConfig().then(setState)
                  }}
                >
                  Apagar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>
      )}
    </div>
  )
}
