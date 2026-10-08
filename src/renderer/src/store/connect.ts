import { useStore } from '.'

/** Liga o store aos avisos do processo principal. Devolve a função que desliga e zera o store. */
export function connectStore(): () => void {
  const { session, games, dashboard, userData } = useStore.getState()

  void session.loadCurrent()
  void dashboard.load()

  const offs = [
    window.api.onGameChanged(session.setCurrent),
    window.api.onGameUpdated(games.accept),
    window.api.onDashboardProgress(dashboard.setProgress)
  ]
  window.addEventListener('beforeunload', userData.flush)

  return () => {
    offs.forEach((off) => off())
    window.removeEventListener('beforeunload', userData.flush)
    userData.flush()
    useStore.setState(useStore.getInitialState(), true)
  }
}
