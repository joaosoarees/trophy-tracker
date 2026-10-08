import { app } from 'electron';
import { AppImageUpdater, NsisUpdater } from 'electron-updater';

import { type IAutoUpdater } from '../services/AppUpdates';
import { isSigned, isSmartAppControlOn } from '../steam/windows';

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

/**
 * Windows with Smart App Control on refuses to run an unsigned installer, and
 * there is no per-app exception. Whether the next installer is signed is told
 * by this very app: releases are either all signed or all unsigned, so this
 * stops applying by itself once they are signed.
 */
export async function isInstallBlockedBySystem(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  if (!(await isSmartAppControlOn())) return false;
  return !(await isSigned(app.getPath('exe')));
}
