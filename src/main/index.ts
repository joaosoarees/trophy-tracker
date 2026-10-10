import { join } from 'node:path';

import { app, safeStorage, screen } from 'electron';

import { DEFAULT_LANGUAGE } from '@shared/i18n';
import { IpcEvent } from '@shared/ipcEvents';

import { Ipc } from './ipc/Ipc';
import { MainWindow } from './MainWindow';
import { AccountFollower } from './services/AccountFollower';
import { AppUpdates } from './services/AppUpdates';
import { GameWatcher } from './services/GameWatcher';
import { RunningGame } from './services/RunningGame';
import { SetupService } from './services/SetupService';
import { Tracker } from './services/Tracker';
import { UpdateChecker } from './services/UpdateChecker';
import { FileSteam } from './steam/FileSteam';
import { RegistrySteam } from './steam/RegistrySteam';
import { SteamClient } from './steam/SteamClient';
import { type ISteamLocal } from './steam/SteamLocal';
import { Windows } from './steam/Windows';
import { SecureCipher } from './storage/SecureCipher';
import { Store } from './storage/Store';
import { AutoUpdater } from './system/AutoUpdater';
import { Browser } from './system/Browser';
import { DataFolder } from './system/DataFolder';
import { ErrorLog } from './system/ErrorLog';
import { Releases } from './system/Releases';
import { WindowBounds } from './system/WindowBounds';

// One data folder name on every system, whatever the product is called on screen.
// An explicit --user-data-dir (used to run against a throwaway copy) is respected.
const appData = app.getPath('appData');
// A folder named on the command line (the audit's throwaway one) is used as given.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(appData, 'trophy-tracker'));
}

const errorLog = new ErrorLog(
  join(app.getPath('userData'), 'logs', 'errors.log'),
);

process.on('uncaughtException', (error) =>
  errorLog.write('main: uncaughtException', error.stack ?? error.message),
);
process.on('unhandledRejection', (reason) =>
  errorLog.write(
    'main: unhandledRejection',
    reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
  ),
);

// A second launch focuses the window that is already open instead of starting another app.
if (!app.requestSingleInstanceLock()) app.quit();

// Composition root: builds each piece once and hands it what it depends on.
void app.whenReady().then(async () => {
  const store = new Store(
    app.getPath('userData'),
    SecureCipher.create(safeStorage, process.platform),
    {
      cacheDelay: 1_000,
      report: (message) => errorLog.write('storage', message),
    },
  );
  app.on('before-quit', () => store.flush());
  // Development only: `pnpm audit:ui` points the app at a fake Steam, so it
  // can be driven through unlocks, errors and outages with no real account.
  // An installed app ignores the variable: the user's key is sent to whatever
  // address this is, so it must not be redirectable outside development.
  const fakeSteam = app.isPackaged
    ? undefined
    : process.env.TROPHY_TRACKER_FAKE_STEAM;
  const client = new SteamClient(fetch, DEFAULT_LANGUAGE, fakeSteam);
  const windows = new Windows();
  const browser = new Browser(windows);
  const window = new MainWindow(browser);
  const setup = new SetupService(store, client, (state) =>
    window.send(IpcEvent.stateChanged, state, false),
  );
  // With a fake Steam the local client is fake too: a folder the audit fills
  // in, read the way a Linux install is, or no client at all.
  const fakeSteamHome = process.env.TROPHY_TRACKER_FAKE_STEAM_HOME;
  const local: ISteamLocal = fakeSteam
    ? new FileSteam({
        platform: 'linux',
        ...(fakeSteamHome ? { home: fakeSteamHome } : { exists: () => false }),
      })
    : Windows.hasWindows
      ? new RegistrySteam(windows)
      : new FileSteam();
  const tracker = new Tracker({
    store,
    client,
    readStatMap: (appid) => local.readStatMap(appid),
  });
  const updates = new AppUpdates({
    currentVersion: app.getVersion(),
    auto: AutoUpdater.create(),
    checker: new UpdateChecker({
      currentVersion: app.getVersion(),
      repository: Releases.REPOSITORY,
      apiBase: fakeSteam ? `${fakeSteam}/github` : undefined,
    }),
    isInstallBlocked: () => AutoUpdater.isInstallBlocked(windows),
    attempt: {
      get: () => store.getUpdateAttempt(),
      set: (version) => store.setUpdateAttempt(version),
    },
    onChange: (info) => window.send(IpcEvent.appInfoChanged, info),
    logError: (source, detail) => errorLog.write(source, detail),
  });

  // The game that is running is always the Steam client's account's, so the
  // app follows that account on every system: the registry says who it is on
  // Windows, the client's own files elsewhere.
  const follower = new AccountFollower({
    getSignedInSteamId: () => local.getActiveSteamId(),
    store,
    onFollow: () => window.send(IpcEvent.stateChanged, setup.getState(), true),
  });

  const runningGame = new RunningGame({
    local,
    client,
    store,
    interval: fakeSteam ? 1_000 : undefined,
  });
  const watcher = new GameWatcher({
    getRunningAppId: () => runningGame.getAppId(),
    // The audit cannot wait a minute for each check; a user's app always can.
    intervals: fakeSteam ? { running: 2_000, unlocks: 3_000 } : undefined,
    lastPlayedAppId: () => tracker.lastPlayedAppId(),
    followRunningGame: () => follower.forRunningGame(),
    pollGame: (appid) => setup.attempt(() => tracker.getGame(appid, 'poll')),
    isConfigured: () => setup.isConfigured,
    onCurrentChanged: (current) => window.send(IpcEvent.gameChanged, current),
    onGameUpdated: (view) => window.send(IpcEvent.gameUpdated, view),
  });

  new Ipc({
    setup,
    tracker,
    watcher,
    store,
    window,
    local,
    updates,
    browser,
    dataFolder: new DataFolder(app.getPath('userData')),
    errorLog,
  }).register();
  // Before the window opens, so it opens on the right account.
  if (await follower.onClientChange())
    watcher.forget({ isCurrentIncluded: true });
  app.on('second-instance', () => window.focus());
  window.open({
    title: setup.messages.appTitle,
    alwaysOnTop: store.getAlwaysOnTop(),
    bounds: store.getPreferences().rememberWindow
      ? WindowBounds.restore(
          store.getWindowBounds(),
          screen.getAllDisplays().map((display) => display.workArea),
          MainWindow.MINIMUM_SIZE,
        )
      : null,
    onClose: (bounds) => {
      if (store.getPreferences().rememberWindow) store.setWindowBounds(bounds);
    },
  });
  watcher.start();
  setInterval(
    () =>
      void follower.onClientChange().then((hasSwitched) => {
        // The game on screen belonged to the account that was left.
        if (hasSwitched) watcher.forget({ isCurrentIncluded: true });
      }),
    fakeSteam ? 2_000 : 30_000,
  );
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
