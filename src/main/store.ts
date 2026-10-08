import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AchievementUserData, GameUserData, GameView, Profile } from '../shared/types'
import type { Credentials, RawOwnedGame } from './steam/client'

/** Cifra opcional da chave (safeStorage do Electron, quando há keyring). */
export interface Cipher {
  encrypt(plain: string): string
  decrypt(encoded: string): string
}

interface ConfigFile {
  steamId?: string
  apiKey?: string
  apiKeyEncrypted?: string
  profile?: Profile
}

export interface SummaryEntry {
  total: number
  unlocked: number
  /** Tempo de jogo na leitura; se não mudou, as conquistas também não. */
  playtime: number
}

interface CacheFile {
  library?: { fetchedAt: number; games: RawOwnedGame[] }
  games: Record<string, GameView>
  summaries: Record<string, SummaryEntry>
}

type UserDataFile = Record<string, GameUserData>

export class Store {
  private config: ConfigFile
  private cache: CacheFile
  private userData: UserDataFile

  constructor(
    private dir: string,
    private cipher: Cipher | null = null
  ) {
    mkdirSync(dir, { recursive: true })
    this.config = this.read('config.json', {})
    this.cache = this.read('cache.json', { games: {}, summaries: {} })
    this.userData = this.read('userdata.json', {})
  }

  private read<T>(name: string, fallback: T): T {
    const file = join(this.dir, name)
    if (!existsSync(file)) return fallback
    try {
      return { ...fallback, ...JSON.parse(readFileSync(file, 'utf8')) }
    } catch {
      return fallback
    }
  }

  private write(name: string, data: unknown, mode?: number): void {
    const file = join(this.dir, name)
    writeFileSync(file, JSON.stringify(data, null, 2), { mode })
    if (mode !== undefined) chmodSync(file, mode)
  }

  getCredentials(): Credentials | null {
    const { steamId, apiKey, apiKeyEncrypted } = this.config
    if (!steamId) return null
    try {
      const key = apiKeyEncrypted && this.cipher ? this.cipher.decrypt(apiKeyEncrypted) : apiKey
      return key ? { steamId, apiKey: key } : null
    } catch {
      return null
    }
  }

  getProfile(): Profile | null {
    return this.config.profile ?? null
  }

  setCredentials({ steamId, apiKey }: Credentials, profile: Profile): void {
    this.config = this.cipher
      ? { steamId, apiKeyEncrypted: this.cipher.encrypt(apiKey), profile }
      : { steamId, apiKey, profile }
    this.write('config.json', this.config, 0o600)
  }

  clearCredentials(): void {
    this.config = {}
    this.write('config.json', this.config, 0o600)
    this.cache = { games: {}, summaries: {} }
    this.saveCache()
  }

  private saveCache(): void {
    this.write('cache.json', this.cache)
  }

  getLibrary(): CacheFile['library'] {
    return this.cache.library
  }

  setLibrary(games: RawOwnedGame[], now = Date.now()): void {
    this.cache.library = { fetchedAt: now, games }
    this.saveCache()
  }

  getGame(appid: number): GameView | null {
    return this.cache.games[appid] ?? null
  }

  setGame(view: GameView): void {
    this.cache.games[view.appid] = view
    this.saveCache()
  }

  getSummary(appid: number): SummaryEntry | null {
    return this.cache.summaries[appid] ?? null
  }

  setSummaries(entries: Record<string, SummaryEntry>): void {
    Object.assign(this.cache.summaries, entries)
    this.saveCache()
  }

  getUserData(appid: number): GameUserData {
    return this.userData[appid] ?? {}
  }

  setUserData(appid: number, achievementId: string, data: AchievementUserData): void {
    const game = (this.userData[appid] ??= {})
    if (data.note.trim() === '' && !data.pinned) delete game[achievementId]
    else game[achievementId] = data
    this.write('userdata.json', this.userData)
  }
}
