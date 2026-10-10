import { GamesService } from '@app/services/GamesService';
import type { StoreSlice } from '@app/store/Store';
import { DEFAULT_LANGUAGE, type Language } from '@shared/i18n';
import { type CurrentGame } from '@shared/types/Game';

type SessionStore = {
  /** Interface language; mirrors what the main process has saved. */
  language: Language;
  /** Game open on Steam or, with no game open, the last one played. */
  current: CurrentGame;
};

type SessionActions = {
  setLanguage: (language: Language) => void;
  loadCurrent: () => Promise<void>;
  setCurrent: (current: CurrentGame) => void;
};

export type SessionSlice = SessionStore & SessionActions;

export const createSessionSlice: StoreSlice<SessionSlice> = (set, get) => ({
  language: DEFAULT_LANGUAGE,
  current: null,

  setLanguage: (language) =>
    set(
      (prevState) => {
        prevState.session.language = language;
      },
      false,
      'session/setLanguage',
    ),

  loadCurrent: async () => {
    get().session.setCurrent(await GamesService.getCurrent());
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
});
