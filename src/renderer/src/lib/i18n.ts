import { LANGUAGES, messagesFor, type Messages } from '../../../shared/i18n'
import { useStore } from '@/store'

/** Messages in the current language; the component re-renders when the language changes. */
export function useT(): Messages {
  return messagesFor(useStore((state) => state.session.language))
}

/** Locale for dates, numbers and sorting. */
export function useLocale(): string {
  return LANGUAGES[useStore((state) => state.session.language)].locale
}
