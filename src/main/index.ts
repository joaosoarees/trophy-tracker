import { dirname, join } from 'node:path';

import { app, dialog, safeStorage, screen } from 'electron';

import { messagesFor } from '@shared/i18n';
import { IpcEvent } from '@shared/ipcEvents';

import { Ipc } from './ipc/Ipc';
import { MainWindow } from './MainWindow';
import { AccountChecks } from './services/AccountChecks';
import { AccountFollower } from './services/AccountFollower';
import { Accounts } from './services/Accounts';
import { AppUpdates } from './services/AppUpdates';
import { GameWatcher } from './services/GameWatcher';
import { KeyStatus } from './services/KeyStatus';
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
import { LocalFolder } from './system/LocalFolder';
import { Releases } from './system/Releases';
import { WindowBounds } from './system/WindowBounds';

// One data folder name on every system, whatever the product is called on screen.
// An explicit --user-data-dir (used to run against a throwaway copy) is respected.
const appData = app.getPath('appData');
// A folder named on the command line (the audit's throwaway one) is used as given.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(appData, 'trophy-tracker'));
}

const dataFolder = app.getPath('userData');
const errorLogFile = join(dataFolder, 'logs', 'errors.log');
const errorLog = new ErrorLog(errorLogFile);

process.on('uncaughtException', (error) =>
  errorLog.write('main: uncaughtException', ErrorLog.detailOf(error)),
);
process.on('unhandledRejection', (reason) =>
  errorLog.write('main: unhandledRejection', ErrorLog.detailOf(reason)),
);

/**
 * The app cannot open at all: says why and ends. A box is all Electron can
 * show before there is a window, and nothing would otherwise tell the user
 * why no window came. In the language the folder holds, when it can be read.
 */
const giveUp = (error: unknown): void => {
  errorLog.write('main: startup', ErrorLog.detailOf(error));
  const { appTitle, startup } = messagesFor(Store.languageIn(dataFolder));
  dialog.showErrorBox(
    appTitle,
    DataFolder.canWrite(dataFolder)
      ? startup.failed(errorLogFile)
      : startup.cannotWrite(dataFolder),
  );
  app.exit(1);
};

// Composition root: builds each piece once and hands it what it depends on.
const start = async (): Promise<void> => {
  const store = new Store(
    dataFolder,
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
  const client = new SteamClient(
    fetch,
    () => store.getLanguage(),
    fakeSteam,
    // The audit cannot wait fifteen seconds for a Steam that does not answer;
    // a user's app always does.
    fakeSteam ? () => AbortSignal.timeout(2_000) : undefined,
  );
  const windows = new Windows();
  const browser = new Browser(windows);
  const window = new MainWindow(browser);
  const logError = (source: string, detail: string): void =>
    errorLog.write(source, detail);
  const keys = new KeyStatus(
    store,
    client,
    () => window.send(IpcEvent.stateChanged, setup.getState(), false),
    logError,
  );
  const checks = new AccountChecks(store, client, keys);
  const setup = new SetupService(store, checks, keys);
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
    logError,
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
  const watcher: GameWatcher = new GameWatcher({
    getRunningAppId: () => runningGame.getAppId(),
    // The audit cannot wait a minute for each check; a user's app always can.
    intervals: fakeSteam ? { running: 2_000, unlocks: 3_000 } : undefined,
    lastPlayedAppId: () => tracker.lastPlayedAppId(),
    followRunningGame: () => accounts.followRunningGame(),
    pollGame: (appid) =>
      keys.attempt((onAnswer) => tracker.getGame(appid, 'poll', onAnswer)),
    isConfigured: () => setup.isConfigured,
    onCurrentChanged: (current) => window.send(IpcEvent.gameChanged, current),
    onGameUpdated: (view) => window.send(IpcEvent.gameUpdated, view),
  });
  const accounts = new Accounts({ setup, follower, watcher, logError });

  new Ipc({
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
    folders: {
      data: new LocalFolder(dataFolder),
      // The row shows the file; the button opens the folder it is in.
      errorLog: new LocalFolder(dirname(errorLogFile), errorLogFile),
    },
    errorLog,
  }).register();
  // Before the window opens, so it opens on the right account.
  await accounts.followClient();
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
  setInterval(() => void accounts.followClient(), fakeSteam ? 2_000 : 30_000);
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
};

// A second launch focuses the window that is already open instead of starting
// another app, and wires nothing of its own. The lock is refused as well when
// it cannot be kept in the data folder (one that cannot be created or written
// to), and then there is no other app to focus: this one says why and ends.
if (app.requestSingleInstanceLock()) {
  void app.whenReady().then(start).catch(giveUp);
} else if (DataFolder.canWrite(dataFolder)) {
  app.quit();
} else {
  void app
    .whenReady()
    .then(() => giveUp(new Error(`${dataFolder} cannot be written to`)));
}

app.on('window-all-closed', () => app.quit());
