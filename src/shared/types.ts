export interface Achievement {
  id: string
  name: string
  description: string
  hidden: boolean
  icon: string
  iconGray: string
  /** Percentual global de jogadores que têm a conquista. */
  rarity: number | null
  unlocked: boolean
  /** Epoch em segundos. */
  unlockedAt: number | null
  progress: { current: number; target: number } | null
}

export interface GameView {
  appid: number
  name: string
  total: number
  unlockedCount: number
  achievements: Achievement[]
  fetchedAt: number
  /** Capa larga do jogo; vazia quando a loja não informa. */
  header?: string
}

export interface GameSummary {
  appid: number
  name: string
  icon: string
  /** Miniatura de capa; vazia quando a loja não informa. */
  capsule: string
  playtimeMinutes: number
  lastPlayed: number
  total: number
  unlocked: number
}

export interface Profile {
  steamId: string
  name: string
  avatar: string
}

export type CheckResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string }

/** Resultado do passo do SteamID: só "a Steam disse que não existe" bloqueia. */
export type SteamIdCheck =
  | { status: 'found'; profile: Profile }
  | { status: 'invalid' | 'not-found'; error: string }
  | { status: 'unconfirmed'; steamId: string; reason: string }

export interface AppState {
  configured: boolean
  profile: Profile | null
  /** Motivo de o onboarding ter reaparecido (ex.: chave deixou de funcionar). */
  configError: string | null
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface AchievementUserData {
  note: string
  pinned: boolean
  /** Itens que o usuário lista para saber quais faltam (ex.: colecionáveis). */
  checklist?: ChecklistItem[]
}

export type GameUserData = Record<string, AchievementUserData>

export type GuideSite = 'steam' | 'youtube' | 'google'

export interface Api {
  getState(): Promise<AppState>
  detectSteamId(): Promise<string | null>
  checkSteamId(steamId: string): Promise<SteamIdCheck>
  checkApiKey(steamId: string, apiKey: string): Promise<CheckResult<Profile>>
  checkPrivacy(steamId: string, apiKey: string): Promise<CheckResult<{ gamesWithPlaytime: number }>>
  saveConfig(steamId: string, apiKey: string): Promise<AppState>
  resetConfig(): Promise<AppState>

  getCurrentAppId(): Promise<{ appid: number; running: boolean } | null>
  getGame(appid: number, force?: boolean): Promise<CheckResult<GameView>>
  getDashboard(force?: boolean): Promise<CheckResult<GameSummary[]>>
  getUserData(appid: number): Promise<GameUserData>
  setUserData(appid: number, achievementId: string, data: AchievementUserData): Promise<void>

  getAlwaysOnTop(): Promise<boolean>
  setAlwaysOnTop(value: boolean): Promise<boolean>

  openGuide(site: GuideSite, appid: number, game: string, achievement: string): Promise<void>
  openExternal(target: 'apikey' | 'privacy' | 'account'): Promise<void>

  onGameChanged(cb: (current: { appid: number; running: boolean } | null) => void): () => void
  onGameUpdated(cb: (view: GameView) => void): () => void
  onDashboardProgress(cb: (done: number, total: number) => void): () => void
}
