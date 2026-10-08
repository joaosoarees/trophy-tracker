import { describe, expect, it } from 'vitest';

import { parseBounds, restoreBounds } from '@main/system/windowBounds';

const MINIMUM = { width: 480, height: 520 };
const LAPTOP = { x: 0, y: 0, width: 1920, height: 1040 };
/** A second monitor to the right of the first. */
const SECOND = { x: 1920, y: 0, width: 2560, height: 1400 };

describe('restoreBounds', () => {
  it('reopens the window where it was left', () => {
    const saved = { x: 2000, y: 100, width: 600, height: 860 };

    expect(restoreBounds(saved, [LAPTOP, SECOND], MINIMUM)).toEqual(saved);
  });

  it('uses the defaults when nothing was saved', () => {
    expect(restoreBounds(null, [LAPTOP], MINIMUM)).toBeNull();
  });

  it('uses the defaults when the monitor it was on is gone', () => {
    const saved = { x: 2000, y: 100, width: 600, height: 860 };

    expect(restoreBounds(saved, [LAPTOP], MINIMUM)).toBeNull();
  });

  it('keeps a window that is partly off screen but still reachable', () => {
    const saved = { x: 1700, y: 100, width: 600, height: 860 };

    expect(restoreBounds(saved, [LAPTOP], MINIMUM)).toEqual(saved);
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
  ])('uses the defaults when $why', ({ saved }) => {
    expect(restoreBounds(saved, [LAPTOP], MINIMUM)).toBeNull();
  });
});

describe('parseBounds', () => {
  it('reads bounds that were saved', () => {
    expect(parseBounds({ x: 1, y: 2, width: 600, height: 860 })).toEqual({
      x: 1,
      y: 2,
      width: 600,
      height: 860,
    });
  });

  it.each([
    undefined,
    null,
    'big',
    {},
    { x: 1, y: 2, width: 'wide', height: 860 },
    { x: NaN, y: 2, width: 600, height: 860 },
  ])('treats %j as nothing saved', (value) => {
    expect(parseBounds(value)).toBeNull();
  });
});
