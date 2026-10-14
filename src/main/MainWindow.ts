import { join } from 'node:path';

import { BrowserWindow } from 'electron';

import { type IpcEvent } from '@shared/ipcEvents';
import { isThemeId, type ThemeId, THEMES } from '@shared/themes';

import { type Browser } from './system/Browser';
import { type IBounds } from './system/WindowBounds';
import { WindowFrame } from './system/WindowFrame';

interface IMainWindowOptions {
  title: string;
  alwaysOnTop: boolean;
  /** The theme on screen as the app opens: the window is that colour before anything is drawn. */
  theme: ThemeId;
  /** Size and position to open with; `null` for the defaults. */
  bounds: IBounds | null;
  /** Called with where the window was when it is closed. */
  onClose: (bounds: IBounds) => void;
}

/** The app's single window. Safe to use before it opens and after it closes. */
export class MainWindow {
  /** The narrowest and shortest the layout supports. */
  static readonly MINIMUM_SIZE = { width: 480, height: 520 };

  private win: BrowserWindow | null = null;

  constructor(private readonly browser: Browser) {}

  open({
    title,
    alwaysOnTop,
    theme,
    bounds,
    onClose,
  }: IMainWindowOptions): void {
    const win = new BrowserWindow({
      // Wide enough for the toolbars in the longest language (see
      // docs/interface.md).
      width: 600,
      height: 860,
      ...bounds,
      minWidth: MainWindow.MINIMUM_SIZE.width,
      minHeight: MainWindow.MINIMUM_SIZE.height,
      backgroundColor: THEMES[theme].colors.background,
      // Linux takes the window icon from here; Windows and macOS from the package.
      icon: join(__dirname, '../../build/icon.png'),
      autoHideMenuBar: true,
      ...WindowFrame.options(theme),
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
      void this.browser.open(url);
      return { action: 'deny' };
    });
    // The window only ever shows the app itself; anything else opens in the browser.
    win.webContents.on('will-navigate', (event, url) => {
      if (url === win.webContents.getURL()) return;
      event.preventDefault();
      void this.browser.open(url);
    });

    // The theme goes in the address, so the interface is drawn in it from
    // its first frame, before it has asked for anything.
    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}?theme=${theme}`);
    } else {
      void win.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { theme },
      });
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

  /**
   * Puts what the system draws of the window (its field, and on Windows its
   * buttons) in the theme the interface is showing. A name that is no theme
   * paints nothing: it comes from the interface as it is.
   */
  paint(theme: ThemeId): void {
    if (!this.win || !isThemeId(theme)) return;
    this.win.setBackgroundColor(THEMES[theme].colors.background);
    const buttons = WindowFrame.repaint(theme);
    if (buttons) this.win.setTitleBarOverlay(buttons);
  }

  setTitle(title: string): void {
    this.win?.setTitle(title);
  }

  setAlwaysOnTop(value: boolean): void {
    this.win?.setAlwaysOnTop(value);
  }
}
