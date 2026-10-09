import { describe, expect, it } from 'vitest';

import { windowFrame } from '@main/system/windowFrame';

describe('windowFrame', () => {
  it.each(['win32', 'darwin'] as const)(
    'drops the title bar and keeps the system buttons on %s',
    (platform) => {
      const frame = windowFrame(platform);

      expect(frame.titleBarStyle).toBe('hidden');
      expect(frame.titleBarOverlay).toMatchObject({ height: 36 });
    },
  );

  it('keeps the title bar of the system on Linux', () => {
    expect(windowFrame('linux')).toEqual({});
  });
});
