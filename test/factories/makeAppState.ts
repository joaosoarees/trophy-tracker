import { DEFAULT_ACHIEVEMENT_SORT } from '@shared/achievementSort';
import { DEFAULT_DASHBOARD_SORT } from '@shared/dashboardSort';
import { type IAppState } from '@shared/types/AppState';
import { STEAM_ID } from '@test/helpers';

/** The app set up, in English, with the default list orders. */
export function makeAppState(props: Partial<IAppState> = {}): IAppState {
  return {
    configured: true,
    language: 'en',
    profile: { steamId: STEAM_ID, name: 'player', avatar: '' },
    accounts: [
      {
        steamId: STEAM_ID,
        name: 'player',
        avatar: '',
        keyEnding: 'CDEF',
        isKeyEncrypted: true,
        status: 'valid',
        checkedAt: null,
      },
    ],
    activeSteamId: STEAM_ID,
    achievementSort: DEFAULT_ACHIEVEMENT_SORT,
    dashboardSort: DEFAULT_DASHBOARD_SORT,
    ...props,
  };
}
