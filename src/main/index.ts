import { join } from 'node:path';

import { app } from 'electron';

import { IpcEvent } from '@shared/ipcEvents';

import { registerIpc } from './ipc/registerIpc';
import { GameWatcher } from './services/GameWatcher';
import { SetupService } from './services/SetupService';
import { Tracker } from './services/Tracker';
import { SteamClient } from './steam/client';
import { getRunningAppId, readStatMap, windowsToast } from './steam/windows';
import { createCipher } from './storage/createCipher';
import { migrateUserData } from './storage/migrateUserData';
import { Store } from './storage/Store';
import { MainWindow } from './window';

// One data folder name on every system, whatever the product is called on screen.
// An explicit --user-data-dir (used to run against a throwaway copy) is respected.
const appData = app.getPath('appData');
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(appData, 'trophy-tracker'));
}

// Composition root: builds each piece once and hands it what it depends on.
void app.whenReady().then(() => {
  migrateUserData(
    join(appData, 'steam-trophy-tracker'),
    app.getPath('userData'),
  );
  const store = new Store(app.getPath('userData'), createCipher());
  const client = new SteamClient();
  const setup = new SetupService(store, client);
  const tracker = new Tracker({ store, client, readStatMap });
  const window = new MainWindow();

  const watcher = new GameWatcher({
    getRunningAppId,
    lastPlayedAppId: () => tracker.lastPlayedAppId(),
    pollGame: (appid) => setup.attempt(() => tracker.getGame(appid, 'poll')),
    isConfigured: () => setup.isConfigured,
    messages: () => setup.messages,
    notify: (title, body) => void windowsToast(title, body).catch(() => {}),
    onCurrentChanged: (current) => window.send(IpcEvent.gameChanged, current),
    onGameUpdated: (view) => window.send(IpcEvent.gameUpdated, view),
  });

  registerIpc({ setup, tracker, watcher, store, window });
  window.open({
    title: setup.messages.appTitle,
    alwaysOnTop: store.getAlwaysOnTop(),
  });
  watcher.start();
});

app.on('window-all-closed', () => app.quit());
