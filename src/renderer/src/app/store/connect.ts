import { DashboardService } from '@app/services/DashboardService';
import { GamesService } from '@app/services/GamesService';

import { useStore } from '.';

/** Wires the store to the main process events. Returns the function that unwires it and resets the store (except the language). */
export function connectStore(): () => void {
  const { session, games, dashboard, userData } = useStore.getState();

  void session.loadCurrent();
  void dashboard.load();

  const offs = [
    GamesService.onCurrentChanged(session.setCurrent),
    GamesService.onGameUpdated(games.accept),
    DashboardService.onProgress(dashboard.setProgress),
  ];
  window.addEventListener('beforeunload', userData.flush);

  return () => {
    offs.forEach((off) => off());
    window.removeEventListener('beforeunload', userData.flush);
    userData.flush();
    const { language } = useStore.getState().session;
    useStore.setState(useStore.getInitialState(), true);
    useStore.getState().session.setLanguage(language);
  };
}
