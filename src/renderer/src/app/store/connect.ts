import { AccountsService } from '@app/services/AccountsService';
import { DashboardService } from '@app/services/DashboardService';
import { GamesService } from '@app/services/GamesService';

import { nextStay } from './sameAccount';

import { useStore } from '.';

/**
 * Wires the store to the main process events once the app is set up, for the
 * account being followed. Returns the function that unwires it and drops
 * what was read from Steam for that account; language and settings are kept.
 */
export function connectStore(): () => void {
  const { session, games, dashboard, userData, settings, navigation } =
    useStore.getState();

  // Before anything is asked: what was asked earlier is not for this stay.
  nextStay();
  void session.loadCurrent();
  void dashboard.load();

  const offs = [
    AccountsService.onStateChanged(settings.accept),
    GamesService.onCurrentChanged(session.setCurrent),
    GamesService.onGameUpdated(games.accept),
    DashboardService.onProgress(dashboard.setProgress),
  ];
  window.addEventListener('beforeunload', userData.flush);

  return () => {
    offs.forEach((off) => off());
    window.removeEventListener('beforeunload', userData.flush);
    userData.flush();
    // An undo is for the account being left: it could not apply any more.
    userData.withdrawUndos();
    navigation.forgetPickedGame();

    const initial = useStore.getInitialState();
    useStore.setState((state) => {
      state.games = initial.games;
      state.userData = initial.userData;
      state.dashboard = initial.dashboard;
      state.session.current = null;
    });
  };
}
