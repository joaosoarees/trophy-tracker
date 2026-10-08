import { en, type Messages } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { ptBR } from './locales/pt-BR';

export type { Messages };

/**
 * To add a language: create the file in `locales/` (the `Messages` type flags whatever is
 * left untranslated) and register it here with the name Steam uses for it.
 */
export const LANGUAGES = {
  en: {
    label: 'English',
    messages: en,
    steam: 'english',
    locale: 'en-US',
    country: 'US',
  },
  'pt-BR': {
    label: 'Português (Brasil)',
    messages: ptBR,
    steam: 'brazilian',
    locale: 'pt-BR',
    country: 'BR',
  },
  es: {
    label: 'Español',
    messages: es,
    steam: 'spanish',
    locale: 'es-ES',
    country: 'ES',
  },
  fr: {
    label: 'Français',
    messages: fr,
    steam: 'french',
    locale: 'fr-FR',
    country: 'FR',
  },
} as const satisfies Record<
  string,
  {
    label: string;
    messages: Messages;
    steam: string;
    locale: string;
    country: string;
  }
>;

export type Language = keyof typeof LANGUAGES;

export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as [
  Language,
  ...Language[],
];

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && Object.hasOwn(LANGUAGES, value);

export const messagesFor = (language: Language): Messages =>
  LANGUAGES[language].messages;
