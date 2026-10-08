import { type Language } from '../i18n';

import { type IProfile } from './Profile';

export interface IAppState {
  configured: boolean;
  language: Language;
  profile: IProfile | null;
  /** Why the onboarding showed up again (e.g. the key stopped working). */
  configError: string | null;
}
