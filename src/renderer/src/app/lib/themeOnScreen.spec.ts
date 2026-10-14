import { describe, expect, it } from 'vitest';

import { firstTheme } from './themeOnScreen';

describe('themeOnScreen', () => {
  describe('firstTheme', () => {
    it('should answer the theme in the address when the window was not drawn before', () => {
      const theme = firstTheme('?theme=dracula', null);

      expect(theme).toBe('dracula');
    });

    it('should answer the theme the window was last drawn in when the address names another', () => {
      const theme = firstTheme('?theme=navy', 'dracula');

      expect(theme).toBe('dracula');
    });

    it.each([
      { kind: 'no theme', search: '' },
      { kind: 'a name no theme has', search: '?theme=later' },
    ])(
      'should answer the default theme when the address has $kind',
      ({ search }) => {
        const theme = firstTheme(search, null);

        expect(theme).toBe('navy');
      },
    );

    it('should answer the theme in the address when what was kept is no theme', () => {
      const theme = firstTheme('?theme=dracula', 'later');

      expect(theme).toBe('dracula');
    });
  });
});
