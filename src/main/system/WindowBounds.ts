export interface IBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How much of the window must be on a screen for it to be reachable. */
const VISIBLE_MARGIN = 80;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** The window's size and position, as saved and as restored. */
export class WindowBounds {
  /** Reads saved bounds, whatever is in the file. */
  static parse(value: unknown): IBounds | null {
    if (typeof value !== 'object' || value === null) return null;
    const { x, y, width, height } = value as Record<string, unknown>;
    return isNumber(x) && isNumber(y) && isNumber(width) && isNumber(height)
      ? { x, y, width, height }
      : null;
  }

  /**
   * The bounds to reopen the window with, or `null` to use the defaults. Saved
   * bounds are dropped when they would put the window where it cannot be
   * reached (a monitor that is no longer connected) or make it smaller than
   * the layout supports.
   */
  static restore(
    saved: IBounds | null,
    screens: IBounds[],
    minimum: { width: number; height: number },
  ): IBounds | null {
    if (!saved) return null;
    if (saved.width < minimum.width || saved.height < minimum.height) {
      return null;
    }

    const isReachable = screens.some((screen) => {
      const overlapX =
        Math.min(saved.x + saved.width, screen.x + screen.width) -
        Math.max(saved.x, screen.x);
      const overlapY =
        Math.min(saved.y + saved.height, screen.y + screen.height) -
        Math.max(saved.y, screen.y);
      // The title bar is at the top: it is what has to be on screen.
      const isTitleBarOnScreen =
        saved.y >= screen.y && saved.y < screen.y + screen.height;
      return (
        overlapX >= VISIBLE_MARGIN &&
        overlapY >= VISIBLE_MARGIN &&
        isTitleBarOnScreen
      );
    });
    return isReachable ? saved : null;
  }
}
