import { GamesService } from '@app/services/GamesService';
import { sameAccount } from '@app/store/sameAccount';
import type { StoreSlice } from '@app/store/Store';
import { type IGameView } from '@shared/types/Game';
import { mergeView } from '@shared/view';

type GameEntry = {
  view: IGameView | null;
  isLoading: boolean;
  error: string | null;
  /** Names of the achievements unlocked since the last read, until the notice is dismissed. */
  justUnlocked: string[];
};

type GamesStore = {
  entries: Record<number, GameEntry>;
};

type GamesActions = {
  /** Makes sure a game's screen has data; what was already read shows up instantly. */
  open: (appid: number) => void;
  load: (appid: number, force?: boolean) => Promise<void>;
  /** Takes a new read, reusing what did not change. */
  accept: (view: IGameView) => void;
  dismissUnlocked: (appid: number) => void;
};

export type GamesSlice = GamesStore & GamesActions;

const emptyEntry = (): GameEntry => ({
  view: null,
  isLoading: false,
  error: null,
  justUnlocked: [],
});

export const createGamesSlice: StoreSlice<GamesSlice> = (set, get) => ({
  entries: {},

  open: (appid) => {
    if (!get().games.entries[appid]?.view) void get().games.load(appid);
    void get().userData.load(appid);
  },

  load: async (appid, isForced = false) => {
    if (get().games.entries[appid]?.isLoading) return;
    set(
      (prevState) => {
        (prevState.games.entries[appid] ??= emptyEntry()).isLoading = true;
      },
      false,
      'games/load',
    );

    const isSameAccount = sameAccount(get);
    const result = await GamesService.getGame(appid, isForced);
    if (!isSameAccount()) return;
    if (result.ok) return get().games.accept(result.value);

    set(
      (prevState) => {
        // The entry is gone when its account was left and followed again.
        const entry = (prevState.games.entries[appid] ??= emptyEntry());
        entry.isLoading = false;
        entry.error = result.error;
      },
      false,
      'games/loadFailed',
    );
  },

  accept: (next) =>
    set(
      (prevState) => {
        const entry = (prevState.games.entries[next.appid] ??= emptyEntry());
        const previous = get().games.entries[next.appid]?.view ?? null;
        const view = mergeView(previous, next);
        entry.isLoading = false;
        entry.error = null;
        if (view === previous) return;

        if (previous) {
          const had = new Set(
            previous.achievements.filter((a) => a.unlocked).map((a) => a.id),
          );
          entry.justUnlocked.push(
            ...view.achievements
              .filter((a) => a.unlocked && !had.has(a.id))
              .map((a) => a.name),
          );
        }
        entry.view = view;

        // Keeps the dashboard row up to date without re-reading the dashboard.
        const row = prevState.dashboard.games?.find(
          (g) => g.appid === view.appid,
        );
        if (row) {
          row.unlocked = view.unlockedCount;
          row.total = view.total;
        }
      },
      false,
      'games/accept',
    ),

  dismissUnlocked: (appid) =>
    set(
      (prevState) => {
        const entry = prevState.games.entries[appid];
        if (entry) entry.justUnlocked = [];
      },
      false,
      'games/dismissUnlocked',
    ),
});
