import {
  type BrowserWindowConstructorOptions,
  type TitleBarOverlayOptions,
} from 'electron';

import { type ThemeId, THEMES } from '@shared/themes';

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
  static options(
    theme: ThemeId,
    platform: NodeJS.Platform = process.platform,
  ): FrameOptions {
    if (platform !== 'win32' && platform !== 'darwin') return {};

    return {
      titleBarStyle: 'hidden',
      titleBarOverlay: WindowFrame.buttons(theme),
    };
  }

  /**
   * The system's buttons in the colours of a theme, for a window that is
   * already open, where the system lets them be changed: Windows. `null`
   * elsewhere.
   */
  static repaint(
    theme: ThemeId,
    platform: NodeJS.Platform = process.platform,
  ): TitleBarOverlayOptions | null {
    return platform === 'win32' ? WindowFrame.buttons(theme) : null;
  }

  /** The window's field and its primary text, as the bar they sit on (DESIGN.md). */
  private static buttons(theme: ThemeId): TitleBarOverlayOptions {
    const { background, foreground } = THEMES[theme].colors;
    return {
      color: background,
      symbolColor: foreground,
      height: WINDOW_BAR_HEIGHT,
    };
  }
}
