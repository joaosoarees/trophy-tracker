import { createSaver } from '@/lib/saver';

import type {
  IAchievementUserData,
  GameUserData,
} from '../../../../shared/types';
import type { StoreSlice } from '../Store';

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
    void window.api.setUserData(appid, achievementId, data),
);

export const createUserDataSlice: StoreSlice<UserDataSlice> = (set, get) => ({
  byGame: {},

  load: async (appid) => {
    if (get().userData.byGame[appid]) return;
    const data = await window.api.getUserData(appid);
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
