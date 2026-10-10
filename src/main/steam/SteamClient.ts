import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  type Language,
  type Messages,
} from '@shared/i18n';

const API = 'https://api.steampowered.com';

export type SteamErrorKind =
  | 'invalid-key'
  | 'private'
  | 'no-stats'
  | 'not-found'
  | 'network'
  | 'rate-limited'
  | 'not-configured'
  | 'unknown';

/** Carries only the kind of error; the text is picked in the user's language by `describe`. */
export class SteamError extends Error {
  constructor(
    public kind: SteamErrorKind,
    public status?: number,
    /** Text returned by Steam itself, when there is any. */
    public detail?: string,
  ) {
    super(kind);
  }

  /** The error in the user's language. */
  describe(m: Messages): string {
    switch (this.kind) {
      case 'invalid-key':
        return m.errors.invalidKey;
      case 'private':
        return m.errors.private;
      case 'no-stats':
        return m.errors.noStats;
      case 'not-found':
        return m.errors.notFound;
      case 'network':
        return m.errors.network;
      case 'rate-limited':
        return m.errors.rateLimited;
      case 'not-configured':
        return m.errors.notConfigured;
      case 'unknown':
        return this.detail || m.errors.steamStatus(this.status ?? 0);
    }
  }
}

export interface IRawSchemaAchievement {
  internal_name: string;
  localized_name: string;
  localized_desc: string;
  icon: string;
  icon_gray: string;
  hidden: boolean;
  player_percent_unlocked?: string;
  min_progress_int?: number;
  max_progress_int?: number;
  progress_type?: number;
}

export interface IRawPlayerAchievement {
  apiname: string;
  achieved: number;
  unlocktime: number;
}

export interface IRawOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  rtime_last_played?: number;
}

export interface IRawPlayerSummary {
  /** AppID of the game being played right now; absent when not in a game. */
  gameid?: string;
  steamid: string;
  personaname: string;
  avatarfull: string;
}

export interface IStoreArt {
  header: string;
  capsule: string;
}

const ASSETS = 'https://shared.fastly.steamstatic.com/store_item_assets/';
const STORE_BATCH = 50;

export interface ICredentials {
  steamId: string;
  apiKey: string;
}

export type Fetch = typeof fetch;

/** Shapes of the Steam responses, as far as this app reads them. */
interface IEnvelope<T> {
  response?: T;
}

interface IPlayerStats<T> {
  playerstats?: T & { error?: string };
}

interface IStoreItem {
  appid: number;
  assets?: {
    asset_url_format?: string;
    header?: string;
    small_capsule?: string;
  };
}

export class SteamClient {
  constructor(
    private fetchImpl: Fetch = fetch,
    public language: Language = DEFAULT_LANGUAGE,
    /** Where the Web API is; only the interface audit points it elsewhere. */
    private apiBase: string = API,
  ) {}

  private async get<T>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<T> {
    const url = new URL(this.apiBase + path);
    for (const [k, v] of Object.entries(params))
      url.searchParams.set(k, String(v));

    let res: Response;
    try {
      res = await this.fetchImpl(url);
    } catch {
      throw new SteamError('network');
    }

    const text = await res.text();
    let body: (T & IPlayerStats<object>) | null = null;
    try {
      body = JSON.parse(text) as T & IPlayerStats<object>;
    } catch {
      // Key errors come back as HTML.
    }

    if (res.ok && body) return body;

    const apiError = body?.playerstats?.error ?? '';
    if (/no stats/i.test(apiError)) throw new SteamError('no-stats');
    if (/not public/i.test(apiError)) throw new SteamError('private');
    if (res.status === 401 || (res.status === 403 && !body)) {
      throw new SteamError('invalid-key');
    }
    if (res.status === 403) throw new SteamError('private');
    if (res.status === 429) throw new SteamError('rate-limited');
    throw new SteamError('unknown', res.status, apiError);
  }

  async getPlayerSummary({
    steamId,
    apiKey,
  }: ICredentials): Promise<IRawPlayerSummary> {
    const body = await this.get<IEnvelope<{ players?: IRawPlayerSummary[] }>>(
      '/ISteamUser/GetPlayerSummaries/v2/',
      {
        key: apiKey,
        steamids: steamId,
      },
    );
    const player = body.response?.players?.[0];
    if (!player) throw new SteamError('not-found');
    return player;
  }

  /** Returns `null` when the library is not visible (private profile). */
  async getOwnedGames({
    steamId,
    apiKey,
  }: ICredentials): Promise<IRawOwnedGame[] | null> {
    const body = await this.get<
      IEnvelope<{ games?: IRawOwnedGame[]; game_count?: number }>
    >('/IPlayerService/GetOwnedGames/v1/', {
      key: apiKey,
      steamid: steamId,
      include_appinfo: 1,
      include_played_free_games: 1,
    });
    return (
      body.response?.games ?? (body.response?.game_count === 0 ? [] : null)
    );
  }

  /** Needs no key and includes the description of hidden achievements. */
  async getGameAchievements(appid: number): Promise<IRawSchemaAchievement[]> {
    const body = await this.get<
      IEnvelope<{ achievements?: IRawSchemaAchievement[] }>
    >('/IPlayerService/GetGameAchievements/v1/', {
      appid,
      language: LANGUAGES[this.language].steam,
    });
    return body.response?.achievements ?? [];
  }

  /** Game art, batched and with no key. New games use hashed paths that only the store reports. */
  async getStoreArt(appids: number[]): Promise<Map<number, IStoreArt>> {
    const art = new Map<number, IStoreArt>();
    for (let i = 0; i < appids.length; i += STORE_BATCH) {
      const input = {
        ids: appids.slice(i, i + STORE_BATCH).map((appid) => ({ appid })),
        context: {
          language: LANGUAGES[this.language].steam,
          country_code: LANGUAGES[this.language].country,
        },
        data_request: { include_assets: true },
      };
      const body = await this.get<IEnvelope<{ store_items?: IStoreItem[] }>>(
        '/IStoreBrowseService/GetItems/v1/',
        {
          input_json: JSON.stringify(input),
        },
      );
      for (const item of body.response?.store_items ?? []) {
        const format = item.assets?.asset_url_format;
        const url = (file: string | undefined): string =>
          format && file ? ASSETS + format.replace('${FILENAME}', file) : '';
        art.set(item.appid, {
          header: url(item.assets?.header),
          capsule: url(item.assets?.small_capsule),
        });
      }
    }
    return art;
  }

  async getPlayerAchievements(
    { steamId, apiKey }: ICredentials,
    appid: number,
  ): Promise<IRawPlayerAchievement[]> {
    const body = await this.get<
      IPlayerStats<{ achievements?: IRawPlayerAchievement[] }>
    >('/ISteamUserStats/GetPlayerAchievements/v1/', {
      key: apiKey,
      steamid: steamId,
      appid,
    });
    return body.playerstats?.achievements ?? [];
  }

  async getUserStats(
    { steamId, apiKey }: ICredentials,
    appid: number,
  ): Promise<Record<string, number>> {
    const body = await this.get<
      IPlayerStats<{ stats?: { name: string; value: number }[] }>
    >('/ISteamUserStats/GetUserStatsForGame/v2/', {
      key: apiKey,
      steamid: steamId,
      appid,
    });
    const stats: Record<string, number> = {};
    for (const s of body.playerstats?.stats ?? []) stats[s.name] = s.value;
    return stats;
  }
}
