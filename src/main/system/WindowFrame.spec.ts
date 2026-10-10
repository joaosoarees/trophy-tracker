import { describe, expect, it } from 'vitest';

import { WindowFrame } from './WindowFrame';

describe('WindowFrame', () => {
  describe('options', () => {
    it.each(['win32', 'darwin'] as const)(
      'should hide the title bar and keep the system buttons when the system is %s',
      (platform) => {
        const frame = WindowFrame.options(platform);

        expect(frame).toEqual({
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#171a21',
            symbolColor: '#dfe3e8',
            height: 36,
          },
        });
      },
    );

    it('should keep the title bar of the system when the system is linux', () => {
      const frame = WindowFrame.options('linux');

      expect(frame).toEqual({});
    });
  });
});
