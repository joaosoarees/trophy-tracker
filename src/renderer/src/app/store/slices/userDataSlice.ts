import { toast } from 'sonner';

import { createSaver } from '@app/lib/saver';
import { UserDataService } from '@app/services/UserDataService';
import { sameAccount } from '@app/store/sameAccount';
import type { StoreSlice } from '@app/store/Store';
import { restoreChecklistItem } from '@shared/checklist';
import { messagesFor } from '@shared/i18n';
import {
  type GameUserData,
  type IAchievementUserData,
  type IChecklistItem,
} from '@shared/types/UserData';

type UserDataStore = {
  /** Notes, pins and checklists, per game and per achievement. */
  byGame: Record<number, GameUserData>;
};

type UserDataActions = {
  load: (appid: number) => Promise<void>;
  update: (
    appid: number,
    achievementId: string,
    patch: Partial<IAchievementUserData>,
  ) => void;
  /**
   * Takes back the removal of a checklist item: `item` returns to the list it
   * left (`from`), as that list is now, at `index` (see `restoreChecklistItem`
   * in `@shared/checklist`). Nothing happens when that list is not at hand:
   * another account is in use, or the game was not read again.
   */
  restoreChecklistItem: (
    from: ChecklistPlace,
    item: IChecklistItem,
    index: number,
  ) => void;
  /** Writes right away what is still waiting for the typing pause. */
  flush: () => void;
};

export type UserDataSlice = UserDataStore & UserDataActions;

/** One achievement's user data, of one game, of one account. */
type ChecklistPlace = {
  /** The account the edit was made under, which is where it is saved. */
  steamId: string;
  appid: number;
  achievementId: string;
};

type Edit = ChecklistPlace & {
  /** `undefined` when the achievement had no user data before the edit. */
  data: IAchievementUserData | undefined;
};

export const createUserDataSlice: StoreSlice<UserDataSlice> = (set, get) => {
  // Optimistic update: the edit is on screen at once and saved after a pause.
  // If the save fails, the screen goes back to what is actually saved.
  const saver = createSaver<Edit>({
    save: (_key, { steamId, appid, achievementId, data }) =>
      UserDataService.setUserData(
        appid,
        achievementId,
        data ?? { note: '', pinned: false },
        steamId,
      ),
    onRollback: (key, saved) => {
      const [steamId, appid, achievementId] = splitKey(key);
      toast.error(messagesFor(get().session.language).errors.changeNotSaved);
      // The screen shows another account by now: the edit is not on it.
      if (get().settings.appState?.activeSteamId !== steamId) return;
      set(
        (prevState) => {
          const game = prevState.userData.byGame[appid];
          if (!game) return;
          if (saved?.data) game[achievementId] = saved.data;
          else delete game[achievementId];
        },
        false,
        'userData/rollback',
      );
    },
  });

  return {
    byGame: {},

    load: async (appid) => {
      if (get().userData.byGame[appid]) return;
      const isSameAccount = sameAccount(get);
      const data = await UserDataService.getUserData(appid);
      if (!isSameAccount()) return;
      set(
        (prevState) => {
          prevState.userData.byGame[appid] ??= data;
        },
        false,
        'userData/load',
      );
    },

    update: (appid, achievementId, patch) => {
      // An edit is saved for the account it was made under, whichever is in
      // use by the time it is written. With none there is nobody to write for.
      const steamId = get().settings.appState?.activeSteamId;
      if (!steamId) return;
      const previous = get().userData.byGame[appid]?.[achievementId];
      set(
        (prevState) => {
          const game = (prevState.userData.byGame[appid] ??= {});
          game[achievementId] = {
            ...(game[achievementId] ?? { note: '', pinned: false }),
            ...patch,
          };
        },
        false,
        'userData/update',
      );

      const data = get().userData.byGame[appid][achievementId];
      saver.schedule(
        joinKey(steamId, appid, achievementId),
        { steamId, appid, achievementId, data },
        { steamId, appid, achievementId, data: previous },
      );
    },

    restoreChecklistItem: ({ steamId, appid, achievementId }, item, index) => {
      // The undo outlives the list it was offered on: it is resolved here, at
      // the click, against what the store holds, and only for its own account.
      if (get().settings.appState?.activeSteamId !== steamId) return;
      // Not read again since the account came back: an empty list here would
      // be saved over the real one.
      const game = get().userData.byGame[appid];
      if (!game) return;

      const current = game[achievementId]?.checklist ?? [];
      const checklist = restoreChecklistItem(current, item, index);
      if (checklist === current) return;
      get().userData.update(appid, achievementId, { checklist });
    },

    flush: () => saver.flush(),
  };
};

const joinKey = (
  steamId: string,
  appid: number,
  achievementId: string,
): string => `${steamId}:${appid}:${achievementId}`;

/** Only the achievement id, the last part, may hold the separator. */
function splitKey(key: string): [string, number, string] {
  const [steamId, appid, ...achievementId] = key.split(':');
  return [steamId, Number(appid), achievementId.join(':')];
}
