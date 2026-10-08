import {
  type DashboardMode,
  type IGameSummary,
  type IGameView,
} from '@shared/types/Game';
import { mergeView } from '@shared/view';

import { buildGameView } from '../steam/achievements';
import {
  type SteamClient,
  SteamError,
  type ICredentials,
  type IRawOwnedGame,
  type IRawSchemaAchievement,
  type IStoreArt,
} from '../steam/client';
import type { Store, ISummaryEntry } from '../storage/Store';

const LIBRARY_TTL = 10 * 60_000;
const GAME_TTL = 60_000;
/** A game's achievement list almost never changes. */
const SCHEMA_TTL = 24 * 60 * 60_000;
const CONCURRENCY = 4;

export interface ITrackerDeps {
  store: Store;
  client: SteamClient;
  readStatMap: (appid: number) => Promise<Map<string, string>>;
  now?: () => number;
}

export class Tracker {
  private store: Store;
  private client: SteamClient;
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

  /** Identical simultaneous requests share the same read. */
  private once<T>(key: string, run: () => Promise<T>): Promise<T> {
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

  async library(force = false): Promise<IRawOwnedGame[]> {
    const cached = this.store.getLibrary();
    if (cached && !force && this.now() - cached.fetchedAt < LIBRARY_TTL)
      return cached.games;
    return this.once('library', async () => {
      const games = await this.client.getOwnedGames(this.credentials());
      if (games === null) throw new SteamError('private');
      this.store.setLibrary(games, this.now());
      return games;
    });
  }

  /** Most recently played game, for when no game is open. */
  async lastPlayedAppId(): Promise<number | null> {
    const played = (await this.library()).filter((g) => g.playtime_forever > 0);
    if (played.length === 0) return null;
    return played.reduce((a, b) =>
      (b.rtime_last_played ?? 0) > (a.rtime_last_played ?? 0) ? b : a,
    ).appid;
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
    fresh: boolean,
  ): Promise<IRawSchemaAchievement[]> {
    const cached = this.store.getSchema(appid);
    if (cached && !fresh && this.now() - cached.fetchedAt < SCHEMA_TTL)
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

  private async readGame(
    appid: number,
    fresh: boolean,
    cached: IGameView | null,
  ): Promise<IGameView> {
    const creds = this.credentials();
    const [name, schema, player, art] = await Promise.all([
      this.gameName(appid),
      this.schema(appid, fresh),
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
      ...buildGameView({
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
      this.store.setGame(cached);
      return cached;
    }
    this.store.setGame(view);
    this.store.setSummaries({
      [appid]: {
        ...this.summaryPlaytime(appid),
        total: view.total,
        unlocked: view.unlockedCount,
      },
    });
    return view;
  }

  private summaryPlaytime(appid: number): { playtime: number } {
    const game = this.store.getLibrary()?.games.find((g) => g.appid === appid);
    return { playtime: game?.playtime_forever ?? 0 };
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
    const force = mode === 'all';
    const creds = this.credentials();
    const played = (await this.library(mode !== 'cached')).filter(
      (g) => g.playtime_forever > 0,
    );

    const entries = new Map<number, ISummaryEntry>();
    const pending: IRawOwnedGame[] = [];
    for (const game of played) {
      const cached = this.store.getSummary(game.appid);
      if (cached && !force && cached.playtime === game.playtime_forever)
        entries.set(game.appid, cached);
      else pending.push(game);
    }

    let done = 0;
    const fresh: Record<string, ISummaryEntry> = {};
    const worker = async (): Promise<void> => {
      for (let game = pending.shift(); game; game = pending.shift()) {
        let entry: ISummaryEntry;
        try {
          const list = await this.client.getPlayerAchievements(
            creds,
            game.appid,
          );
          entry = {
            total: list.length,
            unlocked: list.filter((a) => a.achieved === 1).length,
            playtime: game.playtime_forever,
          };
        } catch (e) {
          if (
            !(e instanceof SteamError) ||
            (e.kind !== 'no-stats' && e.kind !== 'unknown')
          )
            throw e;
          entry = { total: 0, unlocked: 0, playtime: game.playtime_forever };
          // A one-off Steam failure must not become "no achievements" in the cache.
          if (e.kind === 'unknown') {
            entries.set(game.appid, entry);
            onProgress?.(++done, total);
            continue;
          }
        }
        entries.set(game.appid, entry);
        fresh[game.appid] = entry;
        onProgress?.(++done, total);
      }
    };
    const total = pending.length;
    try {
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, total) }, worker),
      );
    } finally {
      this.store.setSummaries(fresh);
    }

    const withAchievements = played.filter(
      (g) => (entries.get(g.appid)?.total ?? 0) > 0,
    );
    const art = await this.art(withAchievements.map((g) => g.appid));

    const ratio = (s: IGameSummary): number => s.unlocked / s.total;
    return withAchievements
      .map((g): IGameSummary => {
        const e = entries.get(g.appid)!;
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
          unlocked: e.unlocked,
        };
      })
      .sort((a, b) => {
        const doneA = a.unlocked === a.total;
        const doneB = b.unlocked === b.total;
        if (doneA !== doneB) return doneA ? 1 : -1;
        return ratio(b) - ratio(a) || b.lastPlayed - a.lastPlayed;
      });
  }
}
