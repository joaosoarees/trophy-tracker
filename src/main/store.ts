import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_LANGUAGE, isLanguage, type Language } from '../shared/i18n'
import type { AchievementUserData, GameUserData, GameView, Profile } from '../shared/types'
import type { Credentials, RawOwnedGame, RawSchemaAchievement, StoreArt } from './steam/client'

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
  /** Idioma em que o conteúdo da Steam foi lido. */
  language?: string
  library?: { fetchedAt: number; games: RawOwnedGame[] }
  games: Record<string, GameView>
  summaries: Record<string, SummaryEntry>
  art: Record<string, StoreArt>
  schemas: Record<string, { fetchedAt: number; items: RawSchemaAchievement[] }>
}

interface SettingsFile {
  alwaysOnTop: boolean
  language?: string
}

type UserDataFile = Record<string, GameUserData>

export class Store {
  private config: ConfigFile
  private cache: CacheFile
  private userData: UserDataFile
  private settings: SettingsFile

  constructor(
    private dir: string,
    private cipher: Cipher | null = null
  ) {
    mkdirSync(dir, { recursive: true })
    this.config = this.read('config.json', {})
    this.cache = this.read('cache.json', { games: {}, summaries: {}, art: {}, schemas: {} })
    this.userData = this.read('userdata.json', {})
    this.settings = this.read('settings.json', { alwaysOnTop: false })
    if (this.cache.language !== this.getLanguage()) this.dropTranslatedCache()
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
    this.cache = { games: {}, summaries: {}, art: this.cache.art, schemas: this.cache.schemas, language: this.cache.language }
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

  getSchema(appid: number): CacheFile['schemas'][string] | null {
    return this.cache.schemas[appid] ?? null
  }

  setSchema(appid: number, items: RawSchemaAchievement[], now = Date.now()): void {
    this.cache.schemas[appid] = { fetchedAt: now, items }
    this.saveCache()
  }

  getArt(appid: number): StoreArt | null {
    return this.cache.art[appid] ?? null
  }

  setArt(entries: Map<number, StoreArt>): void {
    for (const [appid, art] of entries) this.cache.art[appid] = art
    this.saveCache()
  }

  getLanguage(): Language {
    return isLanguage(this.settings.language) ? this.settings.language : DEFAULT_LANGUAGE
  }

  /** Trocar de idioma descarta o que veio da Steam já traduzido (conquistas e capas). */
  setLanguage(language: Language): void {
    if (language === this.getLanguage()) return
    this.settings.language = language
    this.write('settings.json', this.settings)
    this.dropTranslatedCache()
  }

  /** Conquistas e capas vêm da Steam já traduzidas; cache de outro idioma não serve. */
  private dropTranslatedCache(): void {
    this.cache.games = {}
    this.cache.schemas = {}
    this.cache.art = {}
    this.cache.language = this.getLanguage()
    this.saveCache()
  }

  getAlwaysOnTop(): boolean {
    return this.settings.alwaysOnTop
  }

  setAlwaysOnTop(value: boolean): void {
    this.settings.alwaysOnTop = value
    this.write('settings.json', this.settings)
  }

  getUserData(appid: number): GameUserData {
    return this.userData[appid] ?? {}
  }

  setUserData(appid: number, achievementId: string, data: AchievementUserData): void {
    const game = (this.userData[appid] ??= {})
    const empty = data.note.trim() === '' && !data.pinned && (data.checklist?.length ?? 0) === 0
    if (empty) delete game[achievementId]
    else game[achievementId] = data
    this.write('userdata.json', this.userData)
  }
}
