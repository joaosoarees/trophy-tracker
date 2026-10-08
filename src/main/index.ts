import { join } from 'node:path';

import { app, screen } from 'electron';

import { DEFAULT_LANGUAGE } from '@shared/i18n';
import { IpcEvent } from '@shared/ipcEvents';

import { registerIpc } from './ipc/registerIpc';
import { AppUpdates } from './services/AppUpdates';
import { GameWatcher } from './services/GameWatcher';
import { RELEASES_REPOSITORY } from './services/releases';
import { createRunningGameSource } from './services/runningGame';
import { SetupService } from './services/SetupService';
import { Tracker } from './services/Tracker';
import { UpdateChecker } from './services/UpdateChecker';
import { SteamClient } from './steam/client';
import { createSteamLocal } from './steam/local';
import { createCipher } from './storage/createCipher';
import { migrateUserData } from './storage/migrateUserData';
import { Store } from './storage/Store';
import {
  createAutoUpdater,
  isInstallBlockedBySystem,
} from './system/autoUpdate';
import { createDataFolderAccess } from './system/dataFolder';
import { logError } from './system/errorLog';
import { restoreBounds } from './system/windowBounds';
import { MainWindow, MINIMUM_SIZE } from './window';

// One data folder name on every system, whatever the product is called on screen.
// An explicit --user-data-dir (used to run against a throwaway copy) is respected.
const appData = app.getPath('appData');
const usesOwnDataFolder = !app.commandLine.hasSwitch('user-data-dir');
if (usesOwnDataFolder) {
  app.setPath('userData', join(appData, 'trophy-tracker'));
}

const errorLog = (): string =>
  join(app.getPath('userData'), 'logs', 'errors.log');
const log = (source: string, detail: string): void =>
  logError(errorLog(), source, detail);

process.on('uncaughtException', (error) =>
  log('main: uncaughtException', error.stack ?? error.message),
);
process.on('unhandledRejection', (reason) =>
  log(
    'main: unhandledRejection',
    reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  ),
);

// A second launch focuses the window that is already open instead of starting another app.
if (!app.requestSingleInstanceLock()) app.quit();

// Composition root: builds each piece once and hands it what it depends on.
void app.whenReady().then(() => {
  // Only into the app's own folder: a throwaway folder named on the command
  // line must stay as it was given, not receive a copy of the user's data.
  if (usesOwnDataFolder) {
    migrateUserData(
      join(appData, 'steam-trophy-tracker'),
      app.getPath('userData'),
    );
  }
  const store = new Store(app.getPath('userData'), createCipher());
  // Development only: `pnpm audit:ui` points the app at a fake Steam, so it
  // can be driven through unlocks, errors and outages with no real account.
  // An installed app ignores the variable: the user's key is sent to whatever
  // address this is, so it must not be redirectable outside development.
  const fakeSteam = app.isPackaged
    ? undefined
    : process.env.TROPHY_TRACKER_FAKE_STEAM;
  const client = new SteamClient(fetch, DEFAULT_LANGUAGE, fakeSteam);
  const setup = new SetupService(store, client);
  // With a fake Steam there is no local client either: the account is typed
  // in and the running game comes from the (fake) Web API.
  const local = fakeSteam
    ? createSteamLocal({ hasWindows: false, exists: () => false })
    : createSteamLocal();
  const tracker = new Tracker({
    store,
    client,
    readStatMap: local.readStatMap,
  });
  const window = new MainWindow();
  const updates = new AppUpdates({
    currentVersion: app.getVersion(),
    auto: createAutoUpdater(),
    checker: new UpdateChecker({
      currentVersion: app.getVersion(),
      repository: RELEASES_REPOSITORY,
      apiBase: fakeSteam ? `${fakeSteam}/github` : undefined,
    }),
    isInstallBlocked: isInstallBlockedBySystem,
    attempt: {
      get: () => store.getUpdateAttempt(),
      set: (version) => store.setUpdateAttempt(version),
    },
    onChange: (info) => window.send(IpcEvent.appInfoChanged, info),
    logError: log,
  });

  const watcher = new GameWatcher({
    getRunningAppId: createRunningGameSource({ local, client, store }),
    lastPlayedAppId: () => tracker.lastPlayedAppId(),
    pollGame: (appid) => setup.attempt(() => tracker.getGame(appid, 'poll')),
    isConfigured: () => setup.isConfigured,
    onCurrentChanged: (current) => window.send(IpcEvent.gameChanged, current),
    onGameUpdated: (view) => window.send(IpcEvent.gameUpdated, view),
  });

  registerIpc({
    setup,
    tracker,
    watcher,
    store,
    window,
    local,
    updates,
    dataFolder: createDataFolderAccess(app.getPath('userData')),
    logError: log,
  });
  app.on('second-instance', () => window.focus());
  window.open({
    title: setup.messages.appTitle,
    alwaysOnTop: store.getAlwaysOnTop(),
    bounds: store.getPreferences().rememberWindow
      ? restoreBounds(
          store.getWindowBounds(),
          screen.getAllDisplays().map((display) => display.workArea),
          MINIMUM_SIZE,
        )
      : null,
    onClose: (bounds) => {
      if (store.getPreferences().rememberWindow) store.setWindowBounds(bounds);
    },
  });
  watcher.start();
  // The app can stay open for days: ask every hour whether the six hours
  // since the last check have passed, and tell the interface what was found.
  setInterval(
    () =>
      void updates
        .getAppInfo()
        .then((info) => window.send(IpcEvent.appInfoChanged, info))
        .catch(() => {}),
    60 * 60 * 1000,
  );
});

app.on('window-all-closed', () => app.quit());
