import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatNumber,
  formatPercent,
  formatPlaytime,
} from './format';

/** Noon in UTC on 12 January 2026, in seconds: the same day in every time zone a test may run in. */
const NOON_OF_12_JANUARY_2026 = 1_768_219_200;

describe('format', () => {
  describe('formatDate', () => {
    it.each([
      { locale: 'en-US', text: 'Jan 12, 2026' },
      { locale: 'pt-BR', text: '12 de jan. de 2026' },
      { locale: 'es-ES', text: '12 ene 2026' },
      { locale: 'fr-FR', text: '12 janv. 2026' },
    ])(
      'should write "$text" when given the seconds Steam reports and the locale $locale',
      ({ locale, text }) => {
        const date = formatDate(NOON_OF_12_JANUARY_2026, locale);

        expect(date).toBe(text);
      },
    );

    it('should write the day with two digits when it has one', () => {
      const date = formatDate(NOON_OF_12_JANUARY_2026 - 7 * 86_400, 'en-US');

      expect(date).toBe('Jan 05, 2026');
    });
  });

  describe('formatNumber', () => {
    it.each([
      { locale: 'en-US', text: '1,234,567' },
      { locale: 'pt-BR', text: '1.234.567' },
      { locale: 'es-ES', text: '1.234.567' },
      { locale: 'fr-FR', text: '1 234 567' },
    ])(
      'should group the thousands as $locale does when the number is large',
      ({ locale, text }) => {
        const number = formatNumber(1_234_567, locale);

        expect(number).toBe(text);
      },
    );

    it('should write the number alone when it is under a thousand', () => {
      const number = formatNumber(999, 'en-US');

      expect(number).toBe('999');
    });
  });

  describe('formatPercent', () => {
    it.each([
      { locale: 'en-US', text: '12.3%' },
      { locale: 'pt-BR', text: '12,3%' },
      { locale: 'es-ES', text: '12,3%' },
      { locale: 'fr-FR', text: '12,3%' },
    ])(
      'should write "$text", with the decimal mark of $locale, when the value has more decimals',
      ({ locale, text }) => {
        const percent = formatPercent(12.345, locale);

        expect(percent).toBe(text);
      },
    );

    it('should write no decimal when the value is whole', () => {
      const percent = formatPercent(50, 'en-US');

      expect(percent).toBe('50%');
    });

    it('should round to the nearest tenth when the second decimal is five or more', () => {
      const percent = formatPercent(0.05, 'en-US');

      expect(percent).toBe('0.1%');
    });
  });

  describe('formatPlaytime', () => {
    it.each([
      { minutes: 0, text: '0 min' },
      { minutes: 45, text: '45 min' },
      { minutes: 60, text: '1 h' },
      { minutes: 750, text: '12 h 30 min' },
    ])(
      'should write "$text" when given $minutes minutes',
      ({ minutes, text }) => {
        const playtime = formatPlaytime(minutes);

        expect(playtime).toBe(text);
      },
    );
  });
});
