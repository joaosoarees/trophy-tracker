import type { StoreSlice } from '@app/store/Store';
import { DEFAULT_LANGUAGE, type Language } from '@shared/i18n';

export type CurrentGame = { appid: number; running: boolean } | null;

type SessionStore = {
  /** Interface language; mirrors what the main process has saved. */
  language: Language;
  /** Game open on Steam or, with no game open, the last one played. */
  current: CurrentGame;
  /** Goes up on every failed read; the App checks whether the setup is still valid. */
  failures: number;
};

type SessionActions = {
  setLanguage: (language: Language) => void;
  loadCurrent: () => Promise<void>;
  setCurrent: (current: CurrentGame) => void;
  reportFailure: () => void;
};

export type SessionSlice = SessionStore & SessionActions;

export const createSessionSlice: StoreSlice<SessionSlice> = (set, get) => ({
  language: DEFAULT_LANGUAGE,
  current: null,
  failures: 0,

  setLanguage: (language) =>
    set(
      (prevState) => {
        prevState.session.language = language;
      },
      false,
      'session/setLanguage',
    ),

  loadCurrent: async () => {
    get().session.setCurrent(await window.api.getCurrentAppId());
  },

  setCurrent: (current) => {
    const closed =
      get().session.current?.running === true && current?.running !== true;
    set(
      (prevState) => {
        prevState.session.current = current;
      },
      false,
      'session/setCurrent',
    );
    // Playtime has just changed; re-read only the games that changed.
    if (closed) void get().dashboard.load('changed');
  },

  reportFailure: () =>
    set(
      (prevState) => {
        prevState.session.failures++;
      },
      false,
      'session/reportFailure',
    ),
});
