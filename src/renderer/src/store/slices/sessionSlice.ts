import { DEFAULT_LANGUAGE, type Language } from '../../../../shared/i18n'
import type { StoreSlice } from '../Store'

export type CurrentGame = { appid: number; running: boolean } | null

type SessionStore = {
  /** Idioma da interface; espelha o que o processo principal tem salvo. */
  language: Language
  /** Jogo aberto na Steam ou, sem jogo aberto, o último jogado. */
  current: CurrentGame
  /** Sobe a cada falha de leitura; o App confere se a configuração ainda vale. */
  failures: number
}

type SessionActions = {
  setLanguage: (language: Language) => void
  loadCurrent: () => Promise<void>
  setCurrent: (current: CurrentGame) => void
  reportFailure: () => void
}

export type SessionSlice = SessionStore & SessionActions

export const createSessionSlice: StoreSlice<SessionSlice> = (set, get) => ({
  language: DEFAULT_LANGUAGE,
  current: null,
  failures: 0,

  setLanguage: (language) =>
    set(
      (prevState) => {
        prevState.session.language = language
      },
      false,
      'session/setLanguage'
    ),

  loadCurrent: async () => {
    get().session.setCurrent(await window.api.getCurrentAppId())
  },

  setCurrent: (current) => {
    const closed = get().session.current?.running === true && current?.running !== true
    set(
      (prevState) => {
        prevState.session.current = current
      },
      false,
      'session/setCurrent'
    )
    // O tempo de jogo acabou de mudar; relê só os jogos que mudaram.
    if (closed) void get().dashboard.load('changed')
  },

  reportFailure: () =>
    set(
      (prevState) => {
        prevState.session.failures++
      },
      false,
      'session/reportFailure'
    )
})
