import { describe, expect, it } from 'vitest';

import { WindowFrame } from '@main/system/WindowFrame';

describe('WindowFrame.options', () => {
  it.each(['win32', 'darwin'] as const)(
    'drops the title bar and keeps the system buttons on %s',
    (platform) => {
      const frame = WindowFrame.options(platform);

      expect(frame.titleBarStyle).toBe('hidden');
      expect(frame.titleBarOverlay).toMatchObject({ height: 36 });
    },
  );

  it('keeps the title bar of the system on Linux', () => {
    expect(WindowFrame.options('linux')).toEqual({});
  });
});
