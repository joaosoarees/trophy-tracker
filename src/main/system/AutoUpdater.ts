import { app } from 'electron';
import { AppImageUpdater, NsisUpdater } from 'electron-updater';

import {
  type IAutoUpdater,
  type IAutoUpdaterListener,
} from '../services/AppUpdates';
import { type Windows } from '../steam/Windows';

/** The self-update of the installed app, through electron-updater. */
export class AutoUpdater implements IAutoUpdater {
  private constructor(private readonly updater: NsisUpdater | AppImageUpdater) {
    // `AppUpdates` decides whether a version that was found is downloaded.
    updater.autoDownload = false;
    // A downloaded version is installed when the interface asks, not on exit.
    updater.autoInstallOnAppQuit = false;
    updater.logger = null;
  }

  /**
   * The updater for this install, or `null` where there is none:
   * - Windows (the NSIS installer) and the Linux AppImage can replace themselves;
   * - macOS only accepts updates signed with an Apple certificate;
   * - a .deb install would need the administrator password;
   * - an app run from the source tree has nothing to update.
   */
  static create(): AutoUpdater | null {
    if (!app.isPackaged) return null;
    if (process.platform === 'win32') {
      return new AutoUpdater(new NsisUpdater());
    }
    if (process.platform === 'linux' && process.env.APPIMAGE) {
      return new AutoUpdater(new AppImageUpdater());
    }
    return null;
  }

  /**
   * Windows with Smart App Control on refuses to run an unsigned installer, and
   * there is no per-app exception. Whether the next installer is signed is told
   * by this very app: releases are either all signed or all unsigned, so this
   * stops applying by itself once they are signed.
   */
  static async isInstallBlocked(windows: Windows): Promise<boolean> {
    if (process.platform !== 'win32') return false;
    if (!(await windows.isSmartAppControlOn())) return false;
    return !(await windows.isSigned(app.getPath('exe')));
  }

  start({ onProgress, onReady, onError }: IAutoUpdaterListener): void {
    this.updater.on('download-progress', (info) => onProgress(info.percent));
    this.updater.on('update-downloaded', (info) => onReady(info.version));
    this.updater.on('error', (error) => onError(error.stack ?? error.message));
  }

  async check(): Promise<string | null> {
    return (await this.updater.checkForUpdates())?.updateInfo.version ?? null;
  }

  async download(): Promise<void> {
    await this.updater.downloadUpdate();
  }

  // Silently, and opening the app again afterwards: on Windows the wizard
  // would otherwise come up and ask everything the first install already did.
  install(): void {
    this.updater.quitAndInstall(true, true);
  }
}
