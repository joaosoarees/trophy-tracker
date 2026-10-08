import type { DashboardMode, GameSummary, GameView } from '../shared/types'
import { mergeView } from '../shared/view'
import { buildGameView } from './steam/achievements'
import {
  SteamClient,
  SteamError,
  type Credentials,
  type RawOwnedGame,
  type RawSchemaAchievement,
  type StoreArt
} from './steam/client'
import type { Store, SummaryEntry } from './store'

const LIBRARY_TTL = 10 * 60_000
const GAME_TTL = 60_000
/** A lista de conquistas de um jogo quase nunca muda. */
const SCHEMA_TTL = 24 * 60 * 60_000
const CONCURRENCY = 4

export interface TrackerDeps {
  store: Store
  client: SteamClient
  readStatMap(appid: number): Promise<Map<string, string>>
  now?: () => number
}

export class Tracker {
  private store: Store
  private client: SteamClient
  private readStatMap: TrackerDeps['readStatMap']
  private now: () => number
  private inflight = new Map<string, Promise<unknown>>()
  private statMaps = new Map<number, Map<string, string>>()

  constructor(deps: TrackerDeps) {
    this.store = deps.store
    this.client = deps.client
    this.readStatMap = deps.readStatMap
    this.now = deps.now ?? Date.now
  }

  /** Pedidos idênticos simultâneos compartilham a mesma leitura. */
  private once<T>(key: string, run: () => Promise<T>): Promise<T> {
    const running = this.inflight.get(key) as Promise<T> | undefined
    if (running) return running
    const promise = run().finally(() => this.inflight.delete(key))
    this.inflight.set(key, promise)
    return promise
  }

  private credentials(): Credentials {
    const creds = this.store.getCredentials()
    if (!creds) throw new SteamError('invalid-key', 'O app ainda não foi configurado.')
    return creds
  }

  async library(force = false): Promise<RawOwnedGame[]> {
    const cached = this.store.getLibrary()
    if (cached && !force && this.now() - cached.fetchedAt < LIBRARY_TTL) return cached.games
    return this.once('library', async () => {
      const games = await this.client.getOwnedGames(this.credentials())
      if (games === null) {
        throw new SteamError('private', 'Os detalhes dos jogos do seu perfil não estão públicos.')
      }
      this.store.setLibrary(games, this.now())
      return games
    })
  }

  /** Jogo jogado mais recentemente, para quando não há jogo aberto. */
  async lastPlayedAppId(): Promise<number | null> {
    const played = (await this.library()).filter((g) => g.playtime_forever > 0)
    if (played.length === 0) return null
    return played.reduce((a, b) => ((b.rtime_last_played ?? 0) > (a.rtime_last_played ?? 0) ? b : a)).appid
  }

  /** Capas são enfeite: vêm do cache e qualquer falha da loja só as deixa de fora. */
  private async art(appids: number[]): Promise<Map<number, StoreArt>> {
    const missing = appids.filter((id) => this.store.getArt(id) === null)
    if (missing.length > 0) {
      try {
        const fetched = await this.client.getStoreArt(missing)
        // Guarda também os que a loja não devolveu, para não perguntar de novo.
        for (const id of missing) if (!fetched.has(id)) fetched.set(id, { header: '', capsule: '' })
        this.store.setArt(fetched)
      } catch {
        // segue sem capa
      }
    }
    const result = new Map<number, StoreArt>()
    for (const id of appids) {
      const art = this.store.getArt(id)
      if (art) result.set(id, art)
    }
    return result
  }

  private async gameName(appid: number): Promise<string> {
    const find = (games: RawOwnedGame[]): string | undefined => games.find((g) => g.appid === appid)?.name
    return find(await this.library()) ?? find(await this.library(true)) ?? `App ${appid}`
  }

  private async schema(appid: number, fresh: boolean): Promise<RawSchemaAchievement[]> {
    const cached = this.store.getSchema(appid)
    if (cached && !fresh && this.now() - cached.fetchedAt < SCHEMA_TTL) return cached.items
    const items = await this.client.getGameAchievements(appid)
    this.store.setSchema(appid, items, this.now())
    return items
  }

  private async statMap(appid: number): Promise<Map<string, string>> {
    const known = this.statMaps.get(appid)
    if (known) return known
    const map = await this.readStatMap(appid)
    // Vazio pode ser só o cliente Steam ainda sem o arquivo; tenta de novo depois.
    if (map.size > 0) this.statMaps.set(appid, map)
    return map
  }

  /**
   * `false`: serve do cache se for recente. `'poll'`: relê só o que muda enquanto se joga
   * (estado do jogador e contadores). `true`: relê tudo, inclusive a lista de conquistas.
   * Devolve o mesmo objeto da leitura anterior quando nada mudou.
   */
  async getGame(appid: number, mode: boolean | 'poll' = false): Promise<GameView> {
    const cached = this.store.getGame(appid)
    if (cached && mode === false && this.now() - cached.fetchedAt < GAME_TTL) return cached
    return this.once(`game:${appid}:${mode}`, () => this.readGame(appid, mode === true, cached))
  }

  private async readGame(appid: number, fresh: boolean, cached: GameView | null): Promise<GameView> {
    const creds = this.credentials()
    const [name, schema, player, art] = await Promise.all([
      this.gameName(appid),
      this.schema(appid, fresh),
      this.client.getPlayerAchievements(creds, appid),
      this.art([appid])
    ])

    let statMap = new Map<string, string>()
    let stats: Record<string, number> = {}
    if (schema.some((s) => (s.max_progress_int ?? 0) > 0)) {
      statMap = await this.statMap(appid)
      // Contadores são um extra: se falharem, a lista continua valendo.
      if (statMap.size > 0) stats = await this.client.getUserStats(creds, appid).catch(() => ({}))
    }

    const read: GameView = {
      ...buildGameView({ appid, name, schema, player, stats, statMap, now: this.now() }),
      header: art.get(appid)?.header ?? ''
    }
    const view = mergeView(cached, read)
    if (view === cached) {
      cached.fetchedAt = read.fetchedAt
      this.store.setGame(cached)
      return cached
    }
    this.store.setGame(view)
    this.store.setSummaries({ [appid]: { ...this.summaryPlaytime(appid), total: view.total, unlocked: view.unlockedCount } })
    return view
  }

  private summaryPlaytime(appid: number): { playtime: number } {
    const game = this.store.getLibrary()?.games.find((g) => g.appid === appid)
    return { playtime: game?.playtime_forever ?? 0 }
  }

  /** Jogos já jogados que têm conquistas, do mais perto dos 100% para o mais longe; completos por último. */
  getDashboard(mode: DashboardMode = 'cached', onProgress?: (done: number, total: number) => void): Promise<GameSummary[]> {
    return this.once(`dashboard:${mode}`, () => this.readDashboard(mode, onProgress))
  }

  private async readDashboard(mode: DashboardMode, onProgress?: (done: number, total: number) => void): Promise<GameSummary[]> {
    const force = mode === 'all'
    const creds = this.credentials()
    const played = (await this.library(mode !== 'cached')).filter((g) => g.playtime_forever > 0)

    const entries = new Map<number, SummaryEntry>()
    const pending: RawOwnedGame[] = []
    for (const game of played) {
      const cached = this.store.getSummary(game.appid)
      if (cached && !force && cached.playtime === game.playtime_forever) entries.set(game.appid, cached)
      else pending.push(game)
    }

    let done = 0
    const fresh: Record<string, SummaryEntry> = {}
    const worker = async (): Promise<void> => {
      for (let game = pending.shift(); game; game = pending.shift()) {
        let entry: SummaryEntry
        try {
          const list = await this.client.getPlayerAchievements(creds, game.appid)
          entry = {
            total: list.length,
            unlocked: list.filter((a) => a.achieved === 1).length,
            playtime: game.playtime_forever
          }
        } catch (e) {
          if (!(e instanceof SteamError) || (e.kind !== 'no-stats' && e.kind !== 'unknown')) throw e
          entry = { total: 0, unlocked: 0, playtime: game.playtime_forever }
          // Falha pontual da Steam não vira "sem conquistas" no cache.
          if (e.kind === 'unknown') {
            entries.set(game.appid, entry)
            onProgress?.(++done, total)
            continue
          }
        }
        entries.set(game.appid, entry)
        fresh[game.appid] = entry
        onProgress?.(++done, total)
      }
    }
    const total = pending.length
    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker))
    } finally {
      this.store.setSummaries(fresh)
    }

    const withAchievements = played.filter((g) => (entries.get(g.appid)?.total ?? 0) > 0)
    const art = await this.art(withAchievements.map((g) => g.appid))

    const ratio = (s: GameSummary): number => s.unlocked / s.total
    return withAchievements
      .map((g): GameSummary => {
        const e = entries.get(g.appid)!
        return {
          appid: g.appid,
          name: g.name,
          icon: g.img_icon_url
            ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
            : '',
          capsule: art.get(g.appid)?.capsule ?? '',
          playtimeMinutes: g.playtime_forever,
          lastPlayed: g.rtime_last_played ?? 0,
          total: e.total,
          unlocked: e.unlocked
        }
      })
      .sort((a, b) => {
        const doneA = a.unlocked === a.total
        const doneB = b.unlocked === b.total
        if (doneA !== doneB) return doneA ? 1 : -1
        return ratio(b) - ratio(a) || b.lastPlayed - a.lastPlayed
      })
  }
}
