import { ipcMain } from 'electron';

import { IpcEvent } from '@shared/ipcEvents';
import { type IApi } from '@shared/types/Api';
import { type LocalFolderId } from '@shared/types/Preferences';

import { type MainWindow } from '../MainWindow';
import { type AccountChecks } from '../services/AccountChecks';
import { type Accounts } from '../services/Accounts';
import { type AppUpdates } from '../services/AppUpdates';
import { type GameWatcher } from '../services/GameWatcher';
import { type KeyStatus } from '../services/KeyStatus';
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
  keys: KeyStatus;
  checks: AccountChecks;
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
      keys,
      checks,
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
      // An account that cannot be read is not offered, as when nobody is signed in.
      detectSteamId: () => local.getActiveSteamId().catch(() => null),
      checkApiKey: (steamId, apiKey) => checks.checkApiKey(steamId, apiKey),
      checkPrivacy: (steamId, apiKey) => checks.checkPrivacy(steamId, apiKey),
      addAccount: (steamId, apiKey) => accounts.add(steamId, apiKey),
      setActiveAccount: (steamId) => accounts.switchTo(steamId),
      removeAccount: (steamId) => accounts.remove(steamId),
      replaceKey: (steamId, apiKey) => setup.replaceKey(steamId, apiKey),
      recheckAccount: (steamId) => setup.recheckAccount(steamId),

      getCurrentAppId: () => watcher.refreshCurrent(),
      getGame: (appid, isForced) =>
        keys.attempt(async (onAnswer, onFailure) => {
          const view = isForced
            ? await tracker.getGame(appid, true, onAnswer)
            : await tracker.getGameStaleFirst(appid, {
                // Steam accepted the key, now or in the refresh behind the scenes.
                onAnswer,
                // The refresh that ran behind the scenes found something new,
                // for the account that is still in use.
                onFresh: (fresh) => {
                  watcher.remember(fresh);
                  window.send(IpcEvent.gameUpdated, fresh);
                },
                // Lets the app notice a key that stopped working, on the
                // account the game was asked for.
                onError: onFailure,
              });
          watcher.remember(view);
          return view;
        }),
      getDashboard: (mode) =>
        keys.attempt((onAnswer) =>
          tracker.getDashboard(
            mode,
            (done, total) =>
              window.send(IpcEvent.dashboardProgress, done, total),
            onAnswer,
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
