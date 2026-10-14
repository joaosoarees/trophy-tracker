import { describe, expect, it } from 'vitest';

import { WindowFrame } from './WindowFrame';

describe('WindowFrame', () => {
  describe('options', () => {
    it.each(['win32', 'darwin'] as const)(
      'should hide the title bar and keep the system buttons, in the theme, when the system is %s',
      (platform) => {
        const frame = WindowFrame.options('dracula', platform);

        expect(frame).toEqual({
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#282a36',
            symbolColor: '#f8f8f2',
            height: 36,
          },
        });
      },
    );

    it('should frame the window for the system it runs on when none is named', () => {
      const frame = WindowFrame.options('navy');

      expect(frame).toEqual(WindowFrame.options('navy', process.platform));
    });

    it('should keep the title bar of the system when the system is linux', () => {
      const frame = WindowFrame.options('navy', 'linux');

      expect(frame).toEqual({});
    });
  });

  describe('repaint', () => {
    it('should answer the system buttons in the colours of the theme when the system is win32', () => {
      const buttons = WindowFrame.repaint('dracula', 'win32');

      expect(buttons).toEqual({
        color: '#282a36',
        symbolColor: '#f8f8f2',
        height: 36,
      });
    });

    it.each(['darwin', 'linux'] as const)(
      'should answer nothing to repaint when the system is %s',
      (platform) => {
        const buttons = WindowFrame.repaint('dracula', platform);

        expect(buttons).toBeNull();
      },
    );
  });
});
