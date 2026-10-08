import { en, type Messages } from './locales/en'
import { ptBR } from './locales/pt-BR'

export type { Messages }

/**
 * Para adicionar um idioma: criar o arquivo em `locales/` (o tipo `Messages` acusa o que
 * faltar traduzir) e registrá-lo aqui com o nome que a Steam usa para ele.
 */
export const LANGUAGES = {
  en: { label: 'English', messages: en, steam: 'english', locale: 'en-US', country: 'US' },
  'pt-BR': { label: 'Português (Brasil)', messages: ptBR, steam: 'brazilian', locale: 'pt-BR', country: 'BR' }
} as const satisfies Record<string, { label: string; messages: Messages; steam: string; locale: string; country: string }>

export type Language = keyof typeof LANGUAGES

export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as [Language, ...Language[]]

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && Object.hasOwn(LANGUAGES, value)

export const messagesFor = (language: Language): Messages => LANGUAGES[language].messages
