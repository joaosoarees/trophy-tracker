import { ipcMain } from 'electron';

import { IpcEvent } from '@shared/ipcEvents';
import { type IApi } from '@shared/types/Api';
import { type LocalFolderId } from '@shared/types/Preferences';

import { type MainWindow } from '../MainWindow';
import { type Accounts } from '../services/Accounts';
import { type AppUpdates } from '../services/AppUpdates';
import { type GameWatcher } from '../services/GameWatcher';
import { type SetupService } from '../services/SetupService';
import { type Tracker } from '../services/Tracker';
import { Achievements } from '../steam/Achievements';
import { type ISteamLocal } from '../steam/SteamLocal';
import { type Store } from '../storage/Store';
import { type Browser } from '../system/Browser';
import { type ErrorLog } from '../system/ErrorLog';
import { type LocalFolder } from '../system/LocalFolder';
import { Releases } from '../system/Releases';

type Invokable = Omit<
  IApi,
  | 'onStateChanged'
  | 'onGameChanged'
  | 'onGameUpdated'
  | 'onDashboardProgress'
  | 'onAppInfoChanged'
>;

/** A handler may answer right away; Electron wraps the value in a promise for the interface. */
type IpcHandlers = {
  [K in keyof Invokable]: (
    ...args: Parameters<Invokable[K]>
  ) => ReturnType<Invokable[K]> | Awaited<ReturnType<Invokable[K]>>;
};

interface IIpcDeps {
  setup: SetupService;
  accounts: Accounts;
  tracker: Tracker;
  watcher: GameWatcher;
  store: Store;
  window: MainWindow;
  local: ISteamLocal;
  updates: AppUpdates;
  browser: Browser;
  folders: Record<LocalFolderId, LocalFolder>;
  errorLog: ErrorLog;
}

/** Answers everything the interface can ask (`IApi`). Handlers only route: the work lives in the services. */
export class Ipc {
  constructor(private readonly deps: IIpcDeps) {}

  register(): void {
    const {
      setup,
      accounts,
      tracker,
      watcher,
      store,
      window,
      local,
      updates,
      browser,
      folders,
      errorLog,
    } = this.deps;

    const handlers: IpcHandlers = {
      getState: () => setup.getState(),
      detectSteamId: () => local.getActiveSteamId(),
      checkApiKey: (steamId, apiKey) => setup.checkApiKey(steamId, apiKey),
      checkPrivacy: (steamId, apiKey) => setup.checkPrivacy(steamId, apiKey),
      addAccount: (steamId, apiKey) => accounts.add(steamId, apiKey),
      setActiveAccount: (steamId) => accounts.switchTo(steamId),
      removeAccount: (steamId) => accounts.remove(steamId),
      replaceKey: (steamId, apiKey) => setup.replaceKey(steamId, apiKey),
      recheckAccount: (steamId) => setup.recheckAccount(steamId),

      getCurrentAppId: () => watcher.refreshCurrent(),
      getGame: (appid, isForced) =>
        setup.attempt(async () => {
          const view = isForced
            ? await tracker.getGame(appid, true)
            : await tracker.getGameStaleFirst(appid, {
                // The refresh that ran behind the scenes found something new.
                onFresh: (fresh) => {
                  watcher.remember(fresh);
                  window.send(IpcEvent.gameUpdated, fresh);
                },
                // Lets the setup notice a key that stopped working.
                onError: (e) => void setup.noticeFailure(e),
              });
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

      setAchievementSort: (sort) => store.setAchievementSort(sort),
      setDashboardSort: (sort) => store.setDashboardSort(sort),

      getAlwaysOnTop: () => store.getAlwaysOnTop(),
      setAlwaysOnTop: (value) => {
        store.setAlwaysOnTop(value);
        window.setAlwaysOnTop(value);
        return value;
      },

      getPreferences: () => store.getPreferences(),
      setPreference: (key, value) => store.setPreference(key, value),

      getFolder: (id) => folders[id].describe(),
      openFolder: (id) => folders[id].open(),

      openGuide: (site, appid, game, achievement) =>
        browser.open(
          Achievements.guideUrl(
            site,
            appid,
            game,
            achievement,
            setup.messages.guides.query,
          ),
        ),
      openExternal: async (page) =>
        page === 'download'
          ? browser.open(
              Releases.downloadUrl({
                version: (await updates.getAppInfo()).newVersion,
              }),
            )
          : browser.openPage(page),
      getAppInfo: () => updates.getAppInfo(),
      checkForUpdates: () => updates.checkNow(),
      installUpdate: () => updates.install(),
      logError: (source, detail) =>
        errorLog.write(`interface: ${source}`, detail),
    };

    for (const [name, handler] of Object.entries(handlers)) {
      ipcMain.handle(name, (_event, ...args: unknown[]) =>
        (handler as (...a: unknown[]) => unknown)(...args),
      );
    }
  }
}
