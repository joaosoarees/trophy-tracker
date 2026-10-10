import { describe, expect, it } from 'vitest';

import { matches } from './text';

describe('text', () => {
  describe('matches', () => {
    it.each([
      { query: '', why: 'empty' },
      { query: '   ', why: 'only spaces' },
    ])('should match anything when the search is $why', ({ query }) => {
      const isMatch = matches(query, 'Sword Saint');

      expect(isMatch).toBe(true);
    });

    it('should match when the search has no field to look in and is empty', () => {
      const isMatch = matches('');

      expect(isMatch).toBe(true);
    });

    it('should not match when the search has text and there is no field to look in', () => {
      const isMatch = matches('sword');

      expect(isMatch).toBe(false);
    });

    it.each([
      { query: 'saint', field: 'Sword Saint', what: 'in another case' },
      { query: 'SWORD', field: 'Sword Saint', what: 'in capitals' },
      { query: 'd sa', field: 'Sword Saint', what: 'across two words' },
      { query: 'coracao', field: 'Coração Valente', what: 'without accents' },
      { query: 'Coração', field: 'coracao valente', what: 'with accents' },
      {
        query: 'élan',
        field: 'Elan vital',
        what: 'with an accent the text lacks',
      },
      { query: '  saint  ', field: 'Sword Saint', what: 'with spaces around' },
    ])(
      'should match "$field" when "$query" is typed $what',
      ({ query, field }) => {
        const isMatch = matches(query, field);

        expect(isMatch).toBe(true);
      },
    );

    it('should match when only the last of several fields has the text', () => {
      const isMatch = matches('kodama', 'Collector', 'Find every Kodama');

      expect(isMatch).toBe(true);
    });

    it.each([
      { query: 'axe', what: 'text none of them has' },
      {
        query: 'saint find',
        what: 'text that ends one of them and starts the next',
      },
    ])(
      'should not match when the fields are searched for $what',
      ({ query }) => {
        const isMatch = matches(query, 'Sword Saint', 'Find every Kodama');

        expect(isMatch).toBe(false);
      },
    );
  });
});
