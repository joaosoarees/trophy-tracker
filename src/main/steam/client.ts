const API = 'https://api.steampowered.com'

export type SteamErrorKind = 'invalid-key' | 'private' | 'no-stats' | 'not-found' | 'network' | 'unknown'

export class SteamError extends Error {
  constructor(
    public kind: SteamErrorKind,
    message: string
  ) {
    super(message)
  }
}

export interface RawSchemaAchievement {
  internal_name: string
  localized_name: string
  localized_desc: string
  icon: string
  icon_gray: string
  hidden: boolean
  player_percent_unlocked?: string
  min_progress_int?: number
  max_progress_int?: number
  progress_type?: number
}

export interface RawPlayerAchievement {
  apiname: string
  achieved: number
  unlocktime: number
}

export interface RawOwnedGame {
  appid: number
  name: string
  playtime_forever: number
  img_icon_url: string
  rtime_last_played?: number
}

export interface RawPlayerSummary {
  steamid: string
  personaname: string
  avatarfull: string
}

export interface StoreArt {
  header: string
  capsule: string
}

const ASSETS = 'https://shared.fastly.steamstatic.com/store_item_assets/'
const STORE_BATCH = 50

export interface Credentials {
  steamId: string
  apiKey: string
}

export type Fetch = typeof fetch

export class SteamClient {
  constructor(
    private fetchImpl: Fetch = fetch,
    private language = 'brazilian'
  ) {}

  private async get(path: string, params: Record<string, string | number>): Promise<any> {
    const url = new URL(API + path)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

    let res: Response
    try {
      res = await this.fetchImpl(url)
    } catch {
      throw new SteamError('network', 'Não foi possível falar com a Steam. Verifique sua conexão.')
    }

    const text = await res.text()
    let body: any = null
    try {
      body = JSON.parse(text)
    } catch {
      // Erros de chave vêm como HTML.
    }

    if (res.ok && body) return body

    const apiError: string = body?.playerstats?.error ?? ''
    if (/no stats/i.test(apiError)) throw new SteamError('no-stats', 'Este jogo não tem conquistas.')
    if (/not public/i.test(apiError)) {
      throw new SteamError('private', 'Os detalhes dos jogos do seu perfil não estão públicos.')
    }
    if (res.status === 401 || (res.status === 403 && !body)) {
      throw new SteamError('invalid-key', 'A Steam recusou a chave da Web API.')
    }
    if (res.status === 403) {
      throw new SteamError('private', 'Os detalhes dos jogos do seu perfil não estão públicos.')
    }
    throw new SteamError('unknown', apiError || `A Steam respondeu com erro ${res.status}.`)
  }

  async getPlayerSummary({ steamId, apiKey }: Credentials): Promise<RawPlayerSummary> {
    const body = await this.get('/ISteamUser/GetPlayerSummaries/v2/', { key: apiKey, steamids: steamId })
    const player = body.response?.players?.[0]
    if (!player) throw new SteamError('not-found', 'Nenhum perfil da Steam encontrado com esse SteamID.')
    return player
  }

  /** Devolve `null` quando a biblioteca não está visível (perfil privado). */
  async getOwnedGames({ steamId, apiKey }: Credentials): Promise<RawOwnedGame[] | null> {
    const body = await this.get('/IPlayerService/GetOwnedGames/v1/', {
      key: apiKey,
      steamid: steamId,
      include_appinfo: 1,
      include_played_free_games: 1
    })
    return body.response?.games ?? (body.response?.game_count === 0 ? [] : null)
  }

  /** Não exige chave e traz a descrição das conquistas ocultas. */
  async getGameAchievements(appid: number): Promise<RawSchemaAchievement[]> {
    const body = await this.get('/IPlayerService/GetGameAchievements/v1/', { appid, language: this.language })
    return body.response?.achievements ?? []
  }

  /** Capas dos jogos, em lote e sem chave. Jogos novos usam caminhos com hash, que só a loja informa. */
  async getStoreArt(appids: number[]): Promise<Map<number, StoreArt>> {
    const art = new Map<number, StoreArt>()
    for (let i = 0; i < appids.length; i += STORE_BATCH) {
      const input = {
        ids: appids.slice(i, i + STORE_BATCH).map((appid) => ({ appid })),
        context: { language: this.language, country_code: 'BR' },
        data_request: { include_assets: true }
      }
      const body = await this.get('/IStoreBrowseService/GetItems/v1/', { input_json: JSON.stringify(input) })
      for (const item of body.response?.store_items ?? []) {
        const format: string | undefined = item.assets?.asset_url_format
        const url = (file: string | undefined): string =>
          format && file ? ASSETS + format.replace('${FILENAME}', file) : ''
        art.set(item.appid, { header: url(item.assets?.header), capsule: url(item.assets?.small_capsule) })
      }
    }
    return art
  }

  async getPlayerAchievements({ steamId, apiKey }: Credentials, appid: number): Promise<RawPlayerAchievement[]> {
    const body = await this.get('/ISteamUserStats/GetPlayerAchievements/v1/', {
      key: apiKey,
      steamid: steamId,
      appid
    })
    return body.playerstats?.achievements ?? []
  }

  async getUserStats({ steamId, apiKey }: Credentials, appid: number): Promise<Record<string, number>> {
    const body = await this.get('/ISteamUserStats/GetUserStatsForGame/v2/', {
      key: apiKey,
      steamid: steamId,
      appid
    })
    const stats: Record<string, number> = {}
    for (const s of body.playerstats?.stats ?? []) stats[s.name] = s.value
    return stats
  }
}
