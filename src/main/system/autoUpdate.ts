import { app } from 'electron';
import { AppImageUpdater, NsisUpdater } from 'electron-updater';

import { type IAutoUpdater } from '../services/AppUpdates';

/**
 * The self-update of the installed app, or `null` where there is none:
 * - Windows (the NSIS installer) and the Linux AppImage can replace themselves;
 * - macOS only accepts updates signed with an Apple certificate;
 * - a .deb install would need the administrator password;
 * - an app run from the source tree has nothing to update.
 */
export function createAutoUpdater(): IAutoUpdater | null {
  if (!app.isPackaged) return null;

  let autoUpdater: NsisUpdater | AppImageUpdater;
  if (process.platform === 'win32') {
    autoUpdater = new NsisUpdater();
  } else if (process.platform === 'linux' && process.env.APPIMAGE) {
    autoUpdater = new AppImageUpdater();
  } else {
    return null;
  }

  autoUpdater.autoDownload = true;
  // The new version is installed when the user asks, never behind their back.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = null;

  return {
    start: ({ onDownloading, onReady, onError }) => {
      autoUpdater.on('update-available', (info) => onDownloading(info.version));
      autoUpdater.on('update-downloaded', (info) => onReady(info.version));
      autoUpdater.on('error', (error) => onError(error.stack ?? error.message));
    },
    check: () => autoUpdater.checkForUpdates(),
    install: () => autoUpdater.quitAndInstall(),
  };
}
