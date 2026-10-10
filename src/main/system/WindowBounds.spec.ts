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

    it.each([
      {
        where: 'to the left of',
        monitor: { x: -1920, y: 0, width: 1920, height: 1080 },
        saved: { x: -1000, y: 100, width: 600, height: 860 },
      },
      {
        where: 'to the right of',
        monitor: { x: 1920, y: 0, width: 1920, height: 1080 },
        saved: { x: 2500, y: 100, width: 600, height: 860 },
      },
      {
        where: 'above',
        monitor: { x: 0, y: -1080, width: 1920, height: 1080 },
        saved: { x: 100, y: -1000, width: 600, height: 860 },
      },
      {
        where: 'below',
        monitor: { x: 0, y: 1040, width: 1920, height: 1080 },
        saved: { x: 100, y: 1200, width: 600, height: 860 },
      },
    ])(
      'should return the saved bounds when the window is on a monitor $where the main one',
      ({ monitor, saved }) => {
        const bounds = WindowBounds.restore(saved, [LAPTOP, monitor], MINIMUM);

        expect(bounds).toEqual(saved);
      },
    );

    it.each([
      {
        direction: 'across',
        saved: { x: 1840, y: 100, width: 600, height: 860 },
      },
      {
        direction: 'down',
        saved: { x: 100, y: 960, width: 600, height: 860 },
      },
    ])(
      'should return the saved bounds when exactly 80 px of the window are on screen $direction',
      ({ saved }) => {
        const bounds = WindowBounds.restore(saved, [LAPTOP], MINIMUM);

        expect(bounds).toEqual(saved);
      },
    );

    it('should return the saved bounds when the window touches the top of the screen', () => {
      const saved = { x: 100, y: 0, width: 600, height: 860 };

      const bounds = WindowBounds.restore(saved, [LAPTOP], MINIMUM);

      expect(bounds).toEqual(saved);
    });

    it('should return the saved bounds when the window is as small as the layout supports', () => {
      const saved = { x: 100, y: 100, width: 480, height: 520 };

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
        why: 'only 79 px of it are on screen across',
        saved: { x: 1841, y: 100, width: 600, height: 860 },
      },
      {
        why: 'only 79 px of it are on screen down',
        saved: { x: 100, y: 961, width: 600, height: 860 },
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

    it('should keep only the four numbers when the saved value holds more', () => {
      const bounds = WindowBounds.parse({
        x: 1,
        y: 2,
        width: 600,
        height: 860,
        display: 'second',
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
      { x: 1, y: '2', width: 600, height: 860 },
      { x: 1, y: 2, width: 600, height: '860' },
    ])('should return null when the saved value is %j', (value) => {
      const bounds = WindowBounds.parse(value);

      expect(bounds).toBeNull();
    });
  });
});
