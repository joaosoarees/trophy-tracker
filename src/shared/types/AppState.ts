import { type IAchievementSort } from '../achievementSort';
import { type IDashboardSort } from '../dashboardSort';
import { type Language } from '../i18n';

import { type IProfile } from './Profile';

export interface IAppState {
  configured: boolean;
  language: Language;
  profile: IProfile | null;
  /** Why the onboarding showed up again (e.g. the key stopped working). */
  configError: string | null;
  /** Order chosen for the pending and the unlocked lists. */
  achievementSort: IAchievementSort;
  /** Order chosen for the ongoing and the complete lists of the dashboard. */
  dashboardSort: IDashboardSort;
}
