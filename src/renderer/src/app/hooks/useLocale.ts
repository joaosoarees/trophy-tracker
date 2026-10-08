import { useStore } from '@app/store';
import { LANGUAGES } from '@shared/i18n';

/** Locale for dates, numbers and sorting. */
export function useLocale(): string {
  return LANGUAGES[useStore((state) => state.session.language)].locale;
}
