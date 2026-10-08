import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_CODES,
  LANGUAGES,
  messagesFor,
} from '../src/shared/i18n';

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
    expect(messagesFor('en').nav.dashboard).toBe('Dashboard');
    expect(messagesFor('pt-BR').nav.dashboard).toBe('Painel');
    expect(messagesFor('es').nav.dashboard).toBe('Panel');
    expect(messagesFor('fr').nav.dashboard).toBe('Tableau de bord');
  });

  it('recognises only registered languages', () => {
    expect(isLanguage('pt-BR')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
    expect(isLanguage('toString')).toBe(false);
  });

  it('every language has the same messages, with lists of the same length', () => {
    const reference = shape(messagesFor('en')).sort();
    for (const code of LANGUAGE_CODES)
      expect(shape(messagesFor(code)).sort()).toEqual(reference);
  });

  it('no message is left empty', () => {
    const empty = (node: unknown): boolean =>
      typeof node === 'string'
        ? node.trim() === ''
        : typeof node === 'object' &&
          node !== null &&
          Object.values(node).some(empty);
    for (const code of LANGUAGE_CODES)
      expect(empty(messagesFor(code))).toBe(false);
  });

  it('each language reports the name Steam uses for it', () => {
    expect(LANGUAGES.en.steam).toBe('english');
    expect(LANGUAGES['pt-BR'].steam).toBe('brazilian');
    expect(LANGUAGES.es.steam).toBe('spanish');
    expect(LANGUAGES.fr.steam).toBe('french');
  });
});
