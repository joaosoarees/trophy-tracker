import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_CODES,
  LANGUAGES,
  messagesFor,
} from '@shared/i18n';

type Tree = { [key: string]: unknown };

/** Path and shape of every message, to compare languages beyond what the type already guarantees. */
function shape(node: unknown, path = ''): string[] {
  if (Array.isArray(node)) return [`${path}[${node.length}]`];
  if (typeof node === 'function') return [`${path}(${node.length})`];
  if (typeof node === 'string') return [path];
  return Object.entries(node as Tree).flatMap(([key, value]) =>
    shape(value, path ? `${path}.${key}` : key),
  );
}

describe('i18n', () => {
  it('defaults to English', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it.each([
    { code: 'en', dashboard: 'Dashboard', steam: 'english' },
    { code: 'pt-BR', dashboard: 'Painel', steam: 'brazilian' },
    { code: 'es', dashboard: 'Panel', steam: 'spanish' },
    { code: 'fr', dashboard: 'Tableau de bord', steam: 'french' },
  ] as const)(
    '$code has its own messages and the name Steam uses for it',
    ({ code, dashboard, steam }) => {
      expect(messagesFor(code).nav.dashboard).toBe(dashboard);
      expect(LANGUAGES[code].steam).toBe(steam);
    },
  );

  it('recognises a registered language', () => {
    expect(isLanguage('pt-BR')).toBe(true);
  });

  it.each(['de', undefined, 'toString'])(
    'does not take %s for a language',
    (value) => {
      expect(isLanguage(value)).toBe(false);
    },
  );

  it.each(LANGUAGE_CODES)(
    '%s has the same messages as English, with lists of the same length',
    (code) => {
      const reference = shape(messagesFor('en')).sort();

      expect(shape(messagesFor(code)).sort()).toEqual(reference);
    },
  );

  it.each(LANGUAGE_CODES)('%s leaves no message empty', (code) => {
    const empty = (node: unknown): boolean =>
      typeof node === 'string'
        ? node.trim() === ''
        : typeof node === 'object' &&
          node !== null &&
          Object.values(node).some(empty);

    expect(empty(messagesFor(code))).toBe(false);
  });
});
