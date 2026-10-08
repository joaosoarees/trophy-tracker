import { DashboardService } from '@app/services/DashboardService';
import { GamesService } from '@app/services/GamesService';

import { useStore } from '.';

/**
 * Wires the store to the main process events once the app is set up.
 * Returns the function that unwires it and drops what was read from Steam;
 * language, settings and navigation are kept.
 */
export function connectStore(): () => void {
  const { session, settings, games, dashboard, userData } = useStore.getState();

  void session.loadCurrent();
  void dashboard.load();
  void settings.loadAppInfo();

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

    const initial = useStore.getInitialState();
    useStore.setState((state) => {
      state.games = initial.games;
      state.userData = initial.userData;
      state.dashboard = initial.dashboard;
      state.session.current = null;
      state.session.failures = 0;
    });
  };
}
