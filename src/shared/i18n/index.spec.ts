import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_CODES,
  LANGUAGES,
  messagesFor,
} from './index';

type Tree = { [key: string]: unknown };

const TRANSLATIONS = LANGUAGE_CODES.filter((code) => code !== 'en');

/** Path and shape of every message, to compare languages beyond what the type already guarantees. */
function shape(node: unknown, path = ''): string[] {
  if (Array.isArray(node)) return [`${path}[${node.length}]`];
  if (typeof node === 'function') return [`${path}(${node.length})`];
  if (typeof node === 'string') return [path];
  return Object.entries(node as Tree).flatMap(([key, value]) =>
    shape(value, path ? `${path}.${key}` : key),
  );
}

/** Whether any text in the tree, at any depth, is blank. */
const hasBlankText = (node: unknown): boolean =>
  typeof node === 'string'
    ? node.trim() === ''
    : typeof node === 'object' &&
      node !== null &&
      Object.values(node).some(hasBlankText);

describe('i18n', () => {
  describe('DEFAULT_LANGUAGE', () => {
    it('should be English', () => {
      expect(DEFAULT_LANGUAGE).toBe('en');
    });
  });

  describe('LANGUAGES', () => {
    it.each([
      { code: 'en', steam: 'english' },
      { code: 'pt-BR', steam: 'brazilian' },
      { code: 'es', steam: 'spanish' },
      { code: 'fr', steam: 'french' },
    ] as const)(
      'should name $code as Steam does: $steam',
      ({ code, steam }) => {
        const steamName = LANGUAGES[code].steam;

        expect(steamName).toBe(steam);
      },
    );

    it.each([
      { code: 'en', label: 'English', locale: 'en-US', country: 'US' },
      {
        code: 'pt-BR',
        label: 'Português (Brasil)',
        locale: 'pt-BR',
        country: 'BR',
      },
      { code: 'es', label: 'Español', locale: 'es-ES', country: 'ES' },
      { code: 'fr', label: 'Français', locale: 'fr-FR', country: 'FR' },
    ] as const)(
      'should offer $code as $label, with the dates of $locale and the store of $country',
      ({ code, label, locale, country }) => {
        const language = LANGUAGES[code];

        expect({
          label: language.label,
          locale: language.locale,
          country: language.country,
        }).toEqual({ label, locale, country });
      },
    );
  });

  describe('LANGUAGE_CODES', () => {
    it('should list the languages in the order they are offered, English first', () => {
      expect(LANGUAGE_CODES).toEqual(['en', 'pt-BR', 'es', 'fr']);
    });
  });

  describe('messagesFor', () => {
    it.each([
      { code: 'en', dashboard: 'Dashboard' },
      { code: 'pt-BR', dashboard: 'Painel' },
      { code: 'es', dashboard: 'Panel' },
      { code: 'fr', dashboard: 'Tableau de bord' },
    ] as const)(
      'should answer the messages of $code when asked for it: $dashboard',
      ({ code, dashboard }) => {
        const messages = messagesFor(code);

        expect(messages.nav.dashboard).toBe(dashboard);
      },
    );

    it.each(TRANSLATIONS)(
      'should give %s the same messages as English, with lists of the same length',
      (code) => {
        const reference = shape(messagesFor('en')).sort();

        const messages = shape(messagesFor(code)).sort();

        expect(messages).toEqual(reference);
      },
    );

    it.each(LANGUAGE_CODES)('should leave no message of %s blank', (code) => {
      const messages = messagesFor(code);

      const hasBlank = hasBlankText(messages);

      expect(hasBlank).toBe(false);
    });
  });

  describe('isLanguage', () => {
    it('should answer true when the language is registered', () => {
      const isRegistered = isLanguage('pt-BR');

      expect(isRegistered).toBe(true);
    });

    it('should answer false when given a list that holds a registered language', () => {
      const isRegistered = isLanguage(['en']);

      expect(isRegistered).toBe(false);
    });

    it.each(['de', undefined, 'toString'])(
      'should answer false when given %s',
      (value) => {
        const isRegistered = isLanguage(value);

        expect(isRegistered).toBe(false);
      },
    );
  });
});
