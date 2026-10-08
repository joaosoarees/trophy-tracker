import { type IAchievementSort } from '../achievementSort';
import { type IDashboardSort } from '../dashboardSort';
import { type Language } from '../i18n';

import { type IAppInfo } from './AppInfo';
import { type IAppState } from './AppState';
import { type CheckResult } from './Check';
import {
  type CurrentGame,
  type DashboardMode,
  type IGameSummary,
  type IGameView,
} from './Game';
import { type ExternalPage, type GuideSite } from './Guide';
import { type IProfile } from './Profile';
import { type GameUserData, type IAchievementUserData } from './UserData';

/** Everything the interface can ask of the main process (exposed as `window.api`). */
export interface IApi {
  getState: () => Promise<IAppState>;
  detectSteamId: () => Promise<string | null>;
  checkApiKey: (
    steamId: string,
    apiKey: string,
  ) => Promise<CheckResult<IProfile>>;
  checkPrivacy: (
    steamId: string,
    apiKey: string,
  ) => Promise<CheckResult<{ gamesWithPlaytime: number }>>;
  saveConfig: (steamId: string, apiKey: string) => Promise<IAppState>;
  resetConfig: () => Promise<IAppState>;

  getCurrentAppId: () => Promise<CurrentGame>;
  getGame: (appid: number, force?: boolean) => Promise<CheckResult<IGameView>>;
  getDashboard: (mode?: DashboardMode) => Promise<CheckResult<IGameSummary[]>>;
  getUserData: (appid: number) => Promise<GameUserData>;
  setUserData: (
    appid: number,
    achievementId: string,
    data: IAchievementUserData,
  ) => Promise<void>;

  /** Saves the language and drops the translated cache; the caller decides whether to reload the window. */
  setLanguage: (language: Language) => Promise<IAppState>;

  setAchievementSort: (sort: IAchievementSort) => Promise<void>;
  setDashboardSort: (sort: IDashboardSort) => Promise<void>;

  getAlwaysOnTop: () => Promise<boolean>;
  setAlwaysOnTop: (value: boolean) => Promise<boolean>;

  openGuide: (
    site: GuideSite,
    appid: number,
    game: string,
    achievement: string,
  ) => Promise<void>;
  openExternal: (target: ExternalPage) => Promise<void>;
  /** The running version and, when a later one was released, which. */
  getAppInfo: () => Promise<IAppInfo>;
  /** Records an interface error in the local log file. */
  logError: (source: string, detail: string) => Promise<void>;

  onGameChanged: (cb: (current: CurrentGame) => void) => () => void;
  onGameUpdated: (cb: (view: IGameView) => void) => () => void;
  onDashboardProgress: (
    cb: (done: number, total: number) => void,
  ) => () => void;
}
