import { createSaver } from '@app/lib/saver';
import { UserDataService } from '@app/services/UserDataService';
import type { StoreSlice } from '@app/store/Store';
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

const saver = createSaver<{
  appid: number;
  achievementId: string;
  data: IAchievementUserData;
}>(
  (_key, { appid, achievementId, data }) =>
    void UserDataService.setUserData(appid, achievementId, data),
);

export const createUserDataSlice: StoreSlice<UserDataSlice> = (set, get) => ({
  byGame: {},

  load: async (appid) => {
    if (get().userData.byGame[appid]) return;
    const data = await UserDataService.getUserData(appid);
    set(
      (prevState) => {
        prevState.userData.byGame[appid] ??= data;
      },
      false,
      'userData/load',
    );
  },

  update: (appid, achievementId, patch) => {
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
    saver.schedule(`${appid}:${achievementId}`, { appid, achievementId, data });
  },

  flush: () => saver.flush(),
});
