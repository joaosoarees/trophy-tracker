import { toast } from 'sonner';

import { createSaver } from '@app/lib/saver';
import { UserDataService } from '@app/services/UserDataService';
import { sameAccount } from '@app/store/sameAccount';
import type { StoreSlice } from '@app/store/Store';
import { messagesFor } from '@shared/i18n';
import {
  type GameUserData,
  type IAchievementUserData,
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
  /** Writes right away what is still waiting for the typing pause. */
  flush: () => void;
};

export type UserDataSlice = UserDataStore & UserDataActions;

type Edit = {
  /** The account the edit was made under, which is where it is saved. */
  steamId: string;
  appid: number;
  achievementId: string;
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
