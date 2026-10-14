import { type IAchievementSort } from '../achievementSort';
import { type IDashboardSort } from '../dashboardSort';
import { type Language } from '../i18n';
import { type ThemeId } from '../themes';

import { type IAccount } from './Account';
import { type IProfile } from './Profile';

export interface IAppState {
  isConfigured: boolean;
  language: Language;
  /** The theme on screen: the one of the account being followed or, with none, of the setup. */
  theme: ThemeId;
  /** The account being followed. */
  profile: IProfile | null;
  /** Every account the app has a key for. */
  accounts: IAccount[];
  activeSteamId: string | null;
  /** Order chosen for the pending and the unlocked lists. */
  achievementSort: IAchievementSort;
  /** Order chosen for the ongoing and the complete lists of the dashboard. */
  dashboardSort: IDashboardSort;
}
