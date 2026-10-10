import { type BrowserWindowConstructorOptions } from 'electron';

/** Height of the app's own top bar: the tab bar, and the system's buttons over it. */
const WINDOW_BAR_HEIGHT = 36;

type FrameOptions = Pick<
  BrowserWindowConstructorOptions,
  'titleBarStyle' | 'titleBarOverlay'
>;

/**
 * How the window is framed on each system. Windows and macOS drop the title
 * bar and keep only the system's own buttons, drawn over the app's top bar
 * (so snapping, the maximise menu and the keyboard keep working); the
 * interface learns where they are from CSS (`env(titlebar-area-*)`) and
 * leaves that space free. Linux keeps the system's title bar: what a
 * frameless window does there depends on the desktop.
 */
export class WindowFrame {
  static options(platform: NodeJS.Platform = process.platform): FrameOptions {
    if (platform !== 'win32' && platform !== 'darwin') return {};

    return {
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        // Night Navy and Glance White, as the bar they sit on (DESIGN.md).
        color: '#171a21',
        symbolColor: '#dfe3e8',
        height: WINDOW_BAR_HEIGHT,
      },
    };
  }
}
