import { LANGUAGES, messagesFor, type Messages } from '../../../shared/i18n'
import { useStore } from '@/store'

/** Mensagens no idioma atual; o componente redesenha quando o idioma muda. */
export function useT(): Messages {
  return messagesFor(useStore((state) => state.session.language))
}

/** Localidade para datas, números e ordenação. */
export function useLocale(): string {
  return LANGUAGES[useStore((state) => state.session.language)].locale
}
