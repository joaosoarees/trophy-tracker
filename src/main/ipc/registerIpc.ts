import { ipcMain } from 'electron';

import { IpcEvent } from '@shared/ipcEvents';
import { type IApi } from '@shared/types/Api';

import { type GameWatcher } from '../services/GameWatcher';
import { type SetupService } from '../services/SetupService';
import { type Tracker } from '../services/Tracker';
import { guideUrl } from '../steam/achievements';
import { getActiveSteamId } from '../steam/windows';
import { type Store } from '../storage/Store';
import { openExternalPage, openUrl } from '../system/browser';
import { type MainWindow } from '../window';

type Invokable = Omit<
  IApi,
  'onGameChanged' | 'onGameUpdated' | 'onDashboardProgress'
>;

/** A handler may answer right away; Electron wraps the value in a promise for the interface. */
type IpcHandlers = {
  [K in keyof Invokable]: (
    ...args: Parameters<Invokable[K]>
  ) => ReturnType<Invokable[K]> | Awaited<ReturnType<Invokable[K]>>;
};

interface IIpcDeps {
  setup: SetupService;
  tracker: Tracker;
  watcher: GameWatcher;
  store: Store;
  window: MainWindow;
}

/** Answers everything the interface can ask (`IApi`). Handlers only route: the work lives in the services. */
export function registerIpc({
  setup,
  tracker,
  watcher,
  store,
  window,
}: IIpcDeps): void {
  const handlers: IpcHandlers = {
    getState: () => setup.getState(),
    detectSteamId: () => getActiveSteamId(),
    checkSteamId: (steamId) => setup.checkSteamId(steamId),
    checkApiKey: (steamId, apiKey) => setup.checkApiKey(steamId, apiKey),
    checkPrivacy: (steamId, apiKey) => setup.checkPrivacy(steamId, apiKey),
    saveConfig: async (steamId, apiKey) => {
      const state = await setup.saveConfig(steamId, apiKey);
      if (state.configured) void watcher.checkRunningGame();
      return state;
    },
    resetConfig: () => {
      watcher.forget({ current: true });
      return setup.resetConfig();
    },

    getCurrentAppId: () => watcher.refreshCurrent(),
    getGame: (appid, force) =>
      setup.attempt(async () => {
        const view = await tracker.getGame(appid, force);
        watcher.remember(view);
        return view;
      }),
    getDashboard: (mode) =>
      setup.attempt(() =>
        tracker.getDashboard(mode, (done, total) =>
          window.send(IpcEvent.dashboardProgress, done, total),
        ),
      ),
    getUserData: (appid) => store.getUserData(appid),
    setUserData: (appid, achievementId, data) =>
      store.setUserData(appid, achievementId, data),

    setLanguage: (language) => {
      const state = setup.setLanguage(language);
      watcher.forget();
      window.setTitle(setup.messages.appTitle);
      return state;
    },

    getAlwaysOnTop: () => store.getAlwaysOnTop(),
    setAlwaysOnTop: (value) => {
      store.setAlwaysOnTop(value);
      window.setAlwaysOnTop(value);
      return value;
    },

    openGuide: (site, appid, game, achievement) =>
      openUrl(
        guideUrl(site, appid, game, achievement, setup.messages.guides.query),
      ),
    openExternal: (page) => openExternalPage(page),
  };

  for (const [name, handler] of Object.entries(handlers)) {
    ipcMain.handle(name, (_event, ...args: unknown[]) =>
      (handler as (...a: unknown[]) => unknown)(...args),
    );
  }
}
