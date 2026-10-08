import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_CODES, LANGUAGES, messagesFor } from '../src/shared/i18n'

type Tree = { [key: string]: unknown }

/** Caminho e formato de cada mensagem, para comparar idiomas além do que o tipo já garante. */
function shape(node: unknown, path = ''): string[] {
  if (Array.isArray(node)) return [`${path}[${node.length}]`]
  if (typeof node === 'function') return [`${path}(${node.length})`]
  if (typeof node === 'string') return [path]
  return Object.entries(node as Tree).flatMap(([key, value]) => shape(value, path ? `${path}.${key}` : key))
}

describe('i18n', () => {
  it('usa inglês por padrão', () => {
    expect(DEFAULT_LANGUAGE).toBe('en')
    expect(messagesFor('en').nav.dashboard).toBe('Dashboard')
    expect(messagesFor('pt-BR').nav.dashboard).toBe('Painel')
  })

  it('reconhece só idiomas cadastrados', () => {
    expect(isLanguage('pt-BR')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
    expect(isLanguage('toString')).toBe(false)
  })

  it('todo idioma tem as mesmas mensagens, com listas do mesmo tamanho', () => {
    const reference = shape(messagesFor('en')).sort()
    for (const code of LANGUAGE_CODES) expect(shape(messagesFor(code)).sort()).toEqual(reference)
  })

  it('nenhuma mensagem ficou vazia', () => {
    const empty = (node: unknown): boolean =>
      typeof node === 'string' ? node.trim() === '' : typeof node === 'object' && node !== null && Object.values(node).some(empty)
    for (const code of LANGUAGE_CODES) expect(empty(messagesFor(code))).toBe(false)
  })

  it('cada idioma informa o nome que a Steam usa para ele', () => {
    expect(LANGUAGES.en.steam).toBe('english')
    expect(LANGUAGES['pt-BR'].steam).toBe('brazilian')
  })
})
