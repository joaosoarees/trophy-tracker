import { join } from 'node:path';

import { BrowserWindow } from 'electron';

import { type IpcEvent } from '@shared/ipcEvents';

import { openUrl } from './system/browser';
import { type IBounds } from './system/windowBounds';
import { windowFrame } from './system/windowFrame';

interface IMainWindowOptions {
  title: string;
  alwaysOnTop: boolean;
  /** Size and position to open with; `null` for the defaults. */
  bounds: IBounds | null;
  /** Called with where the window was when it is closed. */
  onClose: (bounds: IBounds) => void;
}

/** The narrowest and shortest the layout supports. */
export const MINIMUM_SIZE = { width: 480, height: 520 };

/** The app's single window. Safe to use before it opens and after it closes. */
export class MainWindow {
  private win: BrowserWindow | null = null;

  open({ title, alwaysOnTop, bounds, onClose }: IMainWindowOptions): void {
    const win = new BrowserWindow({
      // Wide enough for the toolbars in the longest language (see CLAUDE.md).
      width: 600,
      height: 860,
      ...bounds,
      minWidth: MINIMUM_SIZE.width,
      minHeight: MINIMUM_SIZE.height,
      backgroundColor: '#171a21',
      // Linux takes the window icon from here; Windows and macOS from the package.
      icon: join(__dirname, '../../build/icon.png'),
      autoHideMenuBar: true,
      ...windowFrame(),
      title,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
      },
    });
    this.win = win;

    win.setAlwaysOnTop(alwaysOnTop);
    // The size it had before being maximised or minimised, if it was.
    win.on('close', () => onClose(win.getNormalBounds()));
    win.on('closed', () => (this.win = null));
    win.webContents.setWindowOpenHandler(({ url }) => {
      void openUrl(url);
      return { action: 'deny' };
    });
    // The window only ever shows the app itself; anything else opens in the browser.
    win.webContents.on('will-navigate', (event, url) => {
      if (url === win.webContents.getURL()) return;
      event.preventDefault();
      void openUrl(url);
    });

    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      void win.loadFile(join(__dirname, '../renderer/index.html'));
    }
  }

  /** Pushes an event to the interface. */
  send(event: IpcEvent, ...args: unknown[]): void {
    this.win?.webContents.send(event, ...args);
  }

  /** Brings the window back in front (a second launch of the app lands here). */
  focus(): void {
    if (!this.win) return;
    if (this.win.isMinimized()) this.win.restore();
    this.win.focus();
  }

  setTitle(title: string): void {
    this.win?.setTitle(title);
  }

  setAlwaysOnTop(value: boolean): void {
    this.win?.setAlwaysOnTop(value);
  }
}
