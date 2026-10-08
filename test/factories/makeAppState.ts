import { DEFAULT_ACHIEVEMENT_SORT } from '@shared/achievementSort';
import { DEFAULT_DASHBOARD_SORT } from '@shared/dashboardSort';
import { type IAppState } from '@shared/types/AppState';

/** The app set up, in English, with the default list orders. */
export function makeAppState(props: Partial<IAppState> = {}): IAppState {
  return {
    configured: true,
    language: 'en',
    profile: { steamId: '76561198207154409', name: 'joao', avatar: '' },
    configError: null,
    achievementSort: DEFAULT_ACHIEVEMENT_SORT,
    dashboardSort: DEFAULT_DASHBOARD_SORT,
    ...props,
  };
}
