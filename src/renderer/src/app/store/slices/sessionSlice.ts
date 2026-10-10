import { GamesService } from '@app/services/GamesService';
import { sameAccount } from '@app/store/sameAccount';
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
    const isSameAccount = sameAccount(get);
    const current = await GamesService.getCurrent();
    if (isSameAccount()) get().session.setCurrent(current);
  },

  setCurrent: (current) => {
    const hasClosed =
      get().session.current?.isRunning === true && current?.isRunning !== true;
    set(
      (prevState) => {
        prevState.session.current = current;
      },
      false,
      'session/setCurrent',
    );
    // A game opened on Steam brings the app to it. With no current game
    // nothing is known yet, so nothing is said about what runs.
    if (current !== null) {
      get().navigation.followRunningGame(
        current.isRunning ? current.appid : null,
      );
    }
    // Playtime has just changed; re-read only the games that changed.
    if (hasClosed) void get().dashboard.load('changed');
  },
});
