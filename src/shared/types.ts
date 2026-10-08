import type { Language } from './i18n';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  hidden: boolean;
  icon: string;
  iconGray: string;
  /** Global percentage of players who have the achievement. */
  rarity: number | null;
  unlocked: boolean;
  /** Epoch in seconds. */
  unlockedAt: number | null;
  progress: { current: number; target: number } | null;
}

export interface GameView {
  appid: number;
  name: string;
  total: number;
  unlockedCount: number;
  achievements: Achievement[];
  fetchedAt: number;
  /** Wide game art; empty when the store does not report it. */
  header?: string;
}

export interface GameSummary {
  appid: number;
  name: string;
  icon: string;
  /** Small capsule art; empty when the store does not report it. */
  capsule: string;
  playtimeMinutes: number;
  lastPlayed: number;
  total: number;
  unlocked: number;
}

export interface Profile {
  steamId: string;
  name: string;
  avatar: string;
}

export type CheckResult<T = undefined> =
  { ok: true; value: T } | { ok: false; error: string };

/** Result of the SteamID step: only "Steam said it does not exist" blocks. */
export type SteamIdCheck =
  | { status: 'found'; profile: Profile }
  | { status: 'invalid' | 'not-found'; error: string }
  | { status: 'unconfirmed'; steamId: string; reason: string };

export interface AppState {
  configured: boolean;
  language: Language;
  profile: Profile | null;
  /** Why the onboarding showed up again (e.g. the key stopped working). */
  configError: string | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface AchievementUserData {
  note: string;
  pinned: boolean;
  /** Items the user lists to know which ones are missing (e.g. collectibles). */
  checklist?: ChecklistItem[];
}

export type GameUserData = Record<string, AchievementUserData>;

export type GuideSite = 'steam' | 'youtube' | 'google';

/** `cached`: uses what it already has; `changed`: re-reads the library and only the games that changed; `all`: re-reads everything. */
export type DashboardMode = 'cached' | 'changed' | 'all';

export interface Api {
  getState: () => Promise<AppState>;
  detectSteamId: () => Promise<string | null>;
  checkSteamId: (steamId: string) => Promise<SteamIdCheck>;
  checkApiKey: (
    steamId: string,
    apiKey: string,
  ) => Promise<CheckResult<Profile>>;
  checkPrivacy: (
    steamId: string,
    apiKey: string,
  ) => Promise<CheckResult<{ gamesWithPlaytime: number }>>;
  saveConfig: (steamId: string, apiKey: string) => Promise<AppState>;
  resetConfig: () => Promise<AppState>;

  getCurrentAppId: () => Promise<{ appid: number; running: boolean } | null>;
  getGame: (appid: number, force?: boolean) => Promise<CheckResult<GameView>>;
  getDashboard: (mode?: DashboardMode) => Promise<CheckResult<GameSummary[]>>;
  getUserData: (appid: number) => Promise<GameUserData>;
  setUserData: (
    appid: number,
    achievementId: string,
    data: AchievementUserData,
  ) => Promise<void>;

  /** Saves the language and drops the translated cache; the caller decides whether to reload the window. */
  setLanguage: (language: Language) => Promise<AppState>;

  getAlwaysOnTop: () => Promise<boolean>;
  setAlwaysOnTop: (value: boolean) => Promise<boolean>;

  openGuide: (
    site: GuideSite,
    appid: number,
    game: string,
    achievement: string,
  ) => Promise<void>;
  openExternal: (target: 'apikey' | 'privacy' | 'account') => Promise<void>;

  onGameChanged: (
    cb: (current: { appid: number; running: boolean } | null) => void,
  ) => () => void;
  onGameUpdated: (cb: (view: GameView) => void) => () => void;
  onDashboardProgress: (
    cb: (done: number, total: number) => void,
  ) => () => void;
}
