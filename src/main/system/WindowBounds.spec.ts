import { describe, expect, it } from 'vitest';

import { WindowBounds } from './WindowBounds';

const MINIMUM = { width: 480, height: 520 };
const LAPTOP = { x: 0, y: 0, width: 1920, height: 1040 };
/** A second monitor to the right of the first. */
const SECOND = { x: 1920, y: 0, width: 2560, height: 1400 };

describe('WindowBounds', () => {
  describe('restore', () => {
    it('should return the saved bounds when the window is on a connected monitor', () => {
      const saved = { x: 2000, y: 100, width: 600, height: 860 };

      const bounds = WindowBounds.restore(saved, [LAPTOP, SECOND], MINIMUM);

      expect(bounds).toEqual(saved);
    });

    it('should return the saved bounds when the window is partly off screen but reachable', () => {
      const saved = { x: 1700, y: 100, width: 600, height: 860 };

      const bounds = WindowBounds.restore(saved, [LAPTOP], MINIMUM);

      expect(bounds).toEqual(saved);
    });

    it('should return null when nothing was saved', () => {
      const bounds = WindowBounds.restore(null, [LAPTOP], MINIMUM);

      expect(bounds).toBeNull();
    });

    it('should return null when the monitor the window was on is gone', () => {
      const saved = { x: 2000, y: 100, width: 600, height: 860 };

      const bounds = WindowBounds.restore(saved, [LAPTOP], MINIMUM);

      expect(bounds).toBeNull();
    });

    it.each([
      {
        why: 'only a sliver is on screen',
        saved: { x: 1900, y: 100, width: 600, height: 860 },
      },
      {
        why: 'its title bar is above the screen',
        saved: { x: 100, y: -200, width: 600, height: 860 },
      },
      {
        why: 'it is narrower than the layout supports',
        saved: { x: 100, y: 100, width: 300, height: 860 },
      },
      {
        why: 'it is shorter than the layout supports',
        saved: { x: 100, y: 100, width: 600, height: 200 },
      },
    ])('should return null when $why', ({ saved }) => {
      const bounds = WindowBounds.restore(saved, [LAPTOP], MINIMUM);

      expect(bounds).toBeNull();
    });
  });

  describe('parse', () => {
    it('should return the bounds when all four are numbers', () => {
      const bounds = WindowBounds.parse({
        x: 1,
        y: 2,
        width: 600,
        height: 860,
      });

      expect(bounds).toEqual({ x: 1, y: 2, width: 600, height: 860 });
    });

    it.each([
      undefined,
      null,
      'big',
      {},
      { x: 1, y: 2, width: 'wide', height: 860 },
      { x: NaN, y: 2, width: 600, height: 860 },
    ])('should return null when the saved value is %j', (value) => {
      const bounds = WindowBounds.parse(value);

      expect(bounds).toBeNull();
    });
  });
});
