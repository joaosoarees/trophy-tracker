import { useStore } from '@app/store';
import { messagesFor, type Messages } from '@shared/i18n';

/** Messages in the current language; the component re-renders when the language changes. */
export function useT(): Messages {
  return messagesFor(useStore((state) => state.session.language));
}
