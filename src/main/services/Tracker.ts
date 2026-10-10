import {
  type DashboardMode,
  type IGameSummary,
  type IGameView,
} from '@shared/types/Game';
import { mergeView } from '@shared/view';

import { Achievements } from '../steam/Achievements';
import {
  type SteamClient,
  SteamError,
  type ICredentials,
  type IRawOwnedGame,
  type IRawSchemaAchievement,
  type IStoreArt,
} from '../steam/SteamClient';
import type { Store, ISummaryEntry } from '../storage/Store';

import { Dashboard } from './Dashboard';

const LIBRARY_TTL = 10 * 60_000;
const GAME_TTL = 60_000;
/** A game's achievement list almost never changes. */
const SCHEMA_TTL = 24 * 60 * 60_000;
const CONCURRENCY = 4;

/** The part of `Store` that says whose reads these are and keeps what was read. */
type ReadCache = Pick<
  Store,
  | 'getActiveSteamId'
  | 'getCredentials'
  | 'getLibrary'
  | 'setLibrary'
  | 'getGame'
  | 'setGame'
  | 'getSummary'
  | 'setSummaries'
  | 'getSchema'
  | 'setSchema'
  | 'getArt'
  | 'setArt'
>;

/** The part of `SteamClient` that reads a library, a game and its art. */
type SteamReads = Pick<
  SteamClient,
  | 'getOwnedGames'
  | 'getGameAchievements'
  | 'getPlayerAchievements'
  | 'getUserStats'
  | 'getStoreArt'
>;

export interface ITrackerDeps {
  store: ReadCache;
  client: SteamReads;
  readStatMap: (appid: number) => Promise<Map<string, string>>;
  now?: () => number;
}

export class Tracker {
  private store: ReadCache;
  private client: SteamReads;
  private readStatMap: ITrackerDeps['readStatMap'];
  private now: () => number;
  private inflight = new Map<string, Promise<unknown>>();
  private statMaps = new Map<number, Map<string, string>>();

  constructor(deps: ITrackerDeps) {
    this.store = deps.store;
    this.client = deps.client;
    this.readStatMap = deps.readStatMap;
    this.now = deps.now ?? (() => Date.now());
  }

  /** Identical reads for the same account share one request. */
  private once<T>(name: string, run: () => Promise<T>): Promise<T> {
    const key = `${this.store.getActiveSteamId() ?? ''}:${name}`;
    const running = this.inflight.get(key) as Promise<T> | undefined;
    if (running) return running;
    const promise = run().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private credentials(): ICredentials {
    const creds = this.store.getCredentials();
    if (!creds) throw new SteamError('not-configured');
    return creds;
  }

  async library(isForced = false): Promise<IRawOwnedGame[]> {
    const cached = this.store.getLibrary();
    if (cached && !isForced && this.now() - cached.fetchedAt < LIBRARY_TTL)
      return cached.games;
    return this.once('library', async () => {
      const creds = this.credentials();
      const games = await this.client.getOwnedGames(creds);
      if (games === null) throw new SteamError('private');
      this.store.setLibrary(games, this.now(), creds.steamId);
      return games;
    });
  }

  /** Most recently played game, for when no game is open. */
  async lastPlayedAppId(): Promise<number | null> {
    const played = Dashboard.played(await this.library());
    return Dashboard.mostRecentFirst(played)[0]?.appid ?? null;
  }

  /** Art is decoration: it comes from the cache, and any store failure just leaves it out. */
  private async art(appids: number[]): Promise<Map<number, IStoreArt>> {
    const missing = appids.filter((id) => this.store.getArt(id) === null);
    if (missing.length > 0) {
      try {
        const fetched = await this.client.getStoreArt(missing);
        // Also record the ones the store did not return, so we do not ask again.
        for (const id of missing)
          if (!fetched.has(id)) fetched.set(id, { header: '', capsule: '' });
        this.store.setArt(fetched);
      } catch {
        // carry on without art
      }
    }
    const result = new Map<number, IStoreArt>();
    for (const id of appids) {
      const art = this.store.getArt(id);
      if (art) result.set(id, art);
    }
    return result;
  }

  private async gameName(appid: number): Promise<string> {
    const find = (games: IRawOwnedGame[]): string | undefined =>
      games.find((g) => g.appid === appid)?.name;
    return (
      find(await this.library()) ??
      find(await this.library(true)) ??
      `App ${appid}`
    );
  }

  private async schema(
    appid: number,
    isFresh: boolean,
  ): Promise<IRawSchemaAchievement[]> {
    const cached = this.store.getSchema(appid);
    if (cached && !isFresh && this.now() - cached.fetchedAt < SCHEMA_TTL)
      return cached.items;
    const items = await this.client.getGameAchievements(appid);
    this.store.setSchema(appid, items, this.now());
    return items;
  }

  private async statMap(appid: number): Promise<Map<string, string>> {
    const known = this.statMaps.get(appid);
    if (known) return known;
    const map = await this.readStatMap(appid);
    // Empty may just mean the Steam client has not written the file yet; try again later.
    if (map.size > 0) this.statMaps.set(appid, map);
    return map;
  }

  /**
   * `false`: serves from the cache if recent. `'poll'`: re-reads only what changes while playing
   * (player state and counters). `true`: re-reads everything, including the achievement list.
   * Returns the same object as the previous read when nothing changed.
   */
  async getGame(
    appid: number,
    mode: boolean | 'poll' = false,
  ): Promise<IGameView> {
    const cached = this.store.getGame(appid);
    if (cached && mode === false && this.now() - cached.fetchedAt < GAME_TTL)
      return cached;
    return this.once(`game:${appid}:${mode}`, () =>
      this.readGame(appid, mode === true, cached),
    );
  }

  /**
   * Optimistic read: answers at once with the last known view, however old,
   * and when it is stale refreshes it behind the scenes. `onFresh` gets the
   * new view only if something changed. With nothing cached it is a normal read.
   */
  async getGameStaleFirst(
    appid: number,
    {
      onFresh,
      onError,
    }: { onFresh: (view: IGameView) => void; onError: (e: unknown) => void },
  ): Promise<IGameView> {
    const cached = this.store.getGame(appid);
    if (!cached) return this.getGame(appid);

    if (this.now() - cached.fetchedAt >= GAME_TTL) {
      void this.getGame(appid).then((fresh) => {
        if (fresh !== cached) onFresh(fresh);
      }, onError);
    }
    return cached;
  }

  private async readGame(
    appid: number,
    isFresh: boolean,
    cached: IGameView | null,
  ): Promise<IGameView> {
    const creds = this.credentials();
    const [name, schema, player, art] = await Promise.all([
      this.gameName(appid),
      this.schema(appid, isFresh),
      this.client.getPlayerAchievements(creds, appid),
      this.art([appid]),
    ]);

    let statMap = new Map<string, string>();
    let stats: Record<string, number> = {};
    if (schema.some((s) => (s.max_progress_int ?? 0) > 0)) {
      statMap = await this.statMap(appid);
      // Counters are an extra: if they fail, the list still stands.
      if (statMap.size > 0)
        stats = await this.client.getUserStats(creds, appid).catch(() => ({}));
    }

    const read: IGameView = {
      ...Achievements.buildGameView({
        appid,
        name,
        schema,
        player,
        stats,
        statMap,
        now: this.now(),
      }),
      header: art.get(appid)?.header ?? '',
    };
    const view = mergeView(cached, read);
    if (view === cached) {
      cached.fetchedAt = read.fetchedAt;
      this.store.setGame(cached, creds.steamId);
      return cached;
    }
    this.store.setGame(view, creds.steamId);
    this.store.setSummaries(
      { [appid]: Dashboard.entryOfView(view, this.playtimeOf(appid)) },
      creds.steamId,
    );
    return view;
  }

  private playtimeOf(appid: number): number {
    const game = this.store.getLibrary()?.games.find((g) => g.appid === appid);
    return game?.playtime_forever ?? 0;
  }

  /** Played games that have achievements, from closest to 100% to furthest; complete ones last. */
  getDashboard(
    mode: DashboardMode = 'cached',
    onProgress?: (done: number, total: number) => void,
  ): Promise<IGameSummary[]> {
    return this.once(`dashboard:${mode}`, () =>
      this.readDashboard(mode, onProgress),
    );
  }

  private async readDashboard(
    mode: DashboardMode,
    onProgress?: (done: number, total: number) => void,
  ): Promise<IGameSummary[]> {
    const creds = this.credentials();
    const played = Dashboard.played(await this.library(mode !== 'cached'));

    const entries = new Map<number, ISummaryEntry>();
    const pending: IRawOwnedGame[] = [];
    for (const game of played) {
      const cached = this.store.getSummary(game.appid);
      if (cached && mode !== 'all' && Dashboard.isCurrent(cached, game))
        entries.set(game.appid, cached);
      else pending.push(game);
    }

    let done = 0;
    const fresh: Record<string, ISummaryEntry> = {};
    try {
      await Tracker.pool(pending, CONCURRENCY, async (game) => {
        const { entry, isLasting } = await this.readSummary(creds, game);
        entries.set(game.appid, entry);
        if (isLasting) fresh[game.appid] = entry;
        onProgress?.(++done, pending.length);
      });
    } finally {
      this.store.setSummaries(fresh, creds.steamId);
    }

    const listed = played.filter(
      (game) => (entries.get(game.appid)?.total ?? 0) > 0,
    );
    const art = await this.art(listed.map((game) => game.appid));
    return Dashboard.closestFirst(
      listed.map((game) =>
        Dashboard.summary(game, entries.get(game.appid)!, art.get(game.appid)),
      ),
    );
  }

  /**
   * What Steam says the player has in a game. A game without achievements
   * counts as read; any failure but those two ends the whole read.
   */
  private async readSummary(
    creds: ICredentials,
    game: IRawOwnedGame,
  ): Promise<{ entry: ISummaryEntry; isLasting: boolean }> {
    try {
      const list = await this.client.getPlayerAchievements(creds, game.appid);
      return {
        entry: Dashboard.entry(list, game.playtime_forever),
        isLasting: true,
      };
    } catch (e) {
      if (
        !(e instanceof SteamError) ||
        (e.kind !== 'no-stats' && e.kind !== 'unknown')
      )
        throw e;
      return {
        entry: Dashboard.entry([], game.playtime_forever),
        // A one-off Steam failure must not become "no achievements" in the cache.
        isLasting: e.kind !== 'unknown',
      };
    }
  }

  /** Runs the task over every item, at most `limit` of them at a time. */
  private static async pool<T>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<void>,
  ): Promise<void> {
    const queue = [...items];
    const worker = async (): Promise<void> => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await task(item);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(limit, queue.length) }, worker),
    );
  }
}
