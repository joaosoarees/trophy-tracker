import { type Language } from '@shared/i18n';
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
  | 'getCredentialsOf'
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
  | 'getLanguage'
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

/**
 * Called by a read when Steam answered a request made with the account's key
 * while it ran, and the read worked. A read answered from the cache, or one
 * that only asked what needs no key (an achievement list, art), never calls it.
 */
type OnAnswer = () => void;

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
  /**
   * The library answer (its `fetchedAt`) that was found not to list a game,
   * by account and game.
   */
  private unlisted = new Map<string, number>();

  constructor(deps: ITrackerDeps) {
    this.store = deps.store;
    this.client = deps.client;
    this.readStatMap = deps.readStatMap;
    this.now = deps.now ?? (() => Date.now());
  }

  /**
   * Whose read this is: the account in use as the read starts. Everything the
   * read takes from the store or hands to it afterwards names this account,
   * since another one may be in use by the time Steam answers.
   */
  private owner(): string {
    return this.store.getActiveSteamId() ?? '';
  }

  /**
   * What a read is translated into: the language of the app as the read
   * starts. Steam answers achievement names, descriptions and art in the
   * language each request was made in, and the store drops them all when the
   * language changes, so an answer asked for in the language that was left is
   * not kept (`isStill`), and the read that waited for it starts again.
   */
  private language(): Language {
    return this.store.getLanguage();
  }

  private isStill(language: Language): boolean {
    return this.store.getLanguage() === language;
  }

  /**
   * Identical reads for the same account, in the same language, share one
   * request: a read asked in the new language is not answered by one still
   * running in the language that was left.
   */
  private once<T>(
    owner: string,
    name: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const key = `${owner}:${this.language()}:${name}`;
    const running = this.inflight.get(key) as Promise<T> | undefined;
    if (running) return running;
    const promise = run().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private credentials(owner: string): ICredentials {
    const creds = this.store.getCredentialsOf(owner);
    if (!creds) throw new SteamError('not-configured');
    return creds;
  }

  /** The library of the account in use. */
  library(isForced = false, onAnswer?: OnAnswer): Promise<IRawOwnedGame[]> {
    return this.libraryOf(this.owner(), isForced, onAnswer);
  }

  private async libraryOf(
    owner: string,
    isForced = false,
    onAnswer?: OnAnswer,
  ): Promise<IRawOwnedGame[]> {
    const cached = this.store.getLibrary(owner);
    if (cached && !isForced && this.now() - cached.fetchedAt < LIBRARY_TTL)
      return cached.games;
    const games = await this.once(owner, 'library', async () => {
      const owned = await this.client.getOwnedGames(this.credentials(owner));
      if (owned === null) throw new SteamError('private');
      this.store.setLibrary(owned, this.now(), owner);
      return owned;
    });
    onAnswer?.();
    return games;
  }

  /** Most recently played game, for when no game is open. */
  async lastPlayedAppId(): Promise<number | null> {
    const played = Dashboard.played(await this.library());
    return Dashboard.mostRecentFirst(played)[0]?.appid ?? null;
  }

  /** Art is decoration: it comes from the cache, and any store failure just leaves it out. */
  private async art(appids: number[]): Promise<Map<number, IStoreArt>> {
    const language = this.language();
    const missing = appids.filter((id) => this.store.getArt(id) === null);
    if (missing.length > 0) {
      try {
        const fetched = await this.client.getStoreArt(missing);
        // Also record the ones the store did not return, so we do not ask again.
        for (const id of missing)
          if (!fetched.has(id)) fetched.set(id, { header: '', capsule: '' });
        // Art has no expiry: kept in another language, it would stay.
        if (this.isStill(language)) this.store.setArt(fetched);
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

  /**
   * The name the library gives a game. A game the library on hand does not
   * list may have joined it since, so the library is asked for again, but
   * once per answer: one that was just read, or was already found not to
   * list the game, is not asked for anew until it is no longer fresh.
   */
  private async gameName(owner: string, appid: number): Promise<string> {
    const find = (games: IRawOwnedGame[]): string | undefined =>
      games.find((g) => g.appid === appid)?.name;
    const answerOnHand = (): number | undefined =>
      this.store.getLibrary(owner)?.fetchedAt;
    const key = `${owner}:${appid}`;

    const before = answerOnHand();
    let name = find(await this.libraryOf(owner));
    const isWorthAskingAgain =
      answerOnHand() === before && this.unlisted.get(key) !== before;
    if (name === undefined && isWorthAskingAgain)
      name = find(await this.libraryOf(owner, true));

    if (name !== undefined) {
      this.unlisted.delete(key);
      return name;
    }
    const answer = answerOnHand();
    if (answer !== undefined) this.unlisted.set(key, answer);
    return `App ${appid}`;
  }

  private async schema(
    appid: number,
    isFresh: boolean,
  ): Promise<IRawSchemaAchievement[]> {
    const cached = this.store.getSchema(appid);
    if (cached && !isFresh && this.now() - cached.fetchedAt < SCHEMA_TTL)
      return cached.items;
    const language = this.language();
    const items = await this.client.getGameAchievements(appid);
    if (this.isStill(language)) this.store.setSchema(appid, items, this.now());
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
    onAnswer?: OnAnswer,
  ): Promise<IGameView> {
    const owner = this.owner();
    const language = this.language();
    const cached = this.store.getGame(appid);
    if (cached && mode === false && this.now() - cached.fetchedAt < GAME_TTL)
      return cached;
    const view = await this.once(owner, `game:${appid}:${mode}`, () =>
      this.readGame(owner, language, appid, mode === true, cached),
    );
    // The language changed meanwhile: the game is answered in the new one.
    if (!this.isStill(language)) return this.getGame(appid, mode, onAnswer);
    // A game is never read without asking what the player has in it.
    onAnswer?.();
    return view;
  }

  /**
   * Optimistic read: answers at once with the last known view, however old,
   * and when it is stale refreshes it behind the scenes. `onFresh` gets the
   * new view only if something changed and the account it was read for is
   * still the one in use: the view is kept for its account either way, but it
   * is not the game of whoever is on screen now. With nothing cached it is a
   * normal read. `onAnswer` is called by whichever read asked Steam: the
   * normal one, or the refresh, after this has answered.
   */
  async getGameStaleFirst(
    appid: number,
    {
      onFresh,
      onError,
      onAnswer,
    }: {
      onFresh: (view: IGameView) => void;
      onError: (e: unknown) => void;
      onAnswer?: OnAnswer;
    },
  ): Promise<IGameView> {
    const owner = this.owner();
    const cached = this.store.getGame(appid);
    if (!cached) return this.getGame(appid, false, onAnswer);

    if (this.now() - cached.fetchedAt >= GAME_TTL) {
      void this.getGame(appid, false, onAnswer).then((fresh) => {
        if (fresh !== cached && this.owner() === owner) onFresh(fresh);
      }, onError);
    }
    return cached;
  }

  private async readGame(
    owner: string,
    language: Language,
    appid: number,
    isFresh: boolean,
    cached: IGameView | null,
  ): Promise<IGameView> {
    const creds = this.credentials(owner);
    const [name, schema, player, art] = await Promise.all([
      this.gameName(owner, appid),
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
    // Read, at least in part, in a language the app has left: not kept.
    if (!this.isStill(language)) return view;
    if (view === cached) {
      cached.fetchedAt = read.fetchedAt;
      this.store.setGame(cached, owner);
      return cached;
    }
    this.store.setGame(view, owner);
    this.store.setSummaries(
      { [appid]: Dashboard.entryOfView(view, this.playtimeOf(owner, appid)) },
      owner,
    );
    return view;
  }

  private playtimeOf(owner: string, appid: number): number {
    const library = this.store.getLibrary(owner);
    const game = library?.games.find((g) => g.appid === appid);
    return game?.playtime_forever ?? 0;
  }

  /** Played games that have achievements, from closest to 100% to furthest; complete ones last. */
  async getDashboard(
    mode: DashboardMode = 'cached',
    onProgress?: (done: number, total: number) => void,
    onAnswer?: OnAnswer,
  ): Promise<IGameSummary[]> {
    const owner = this.owner();
    const language = this.language();
    const { games, hasAnswer } = await this.once(
      owner,
      `dashboard:${mode}`,
      () => this.readDashboard(owner, mode, onProgress),
    );
    // The language changed meanwhile: the art is answered in the new one.
    if (!this.isStill(language))
      return this.getDashboard(mode, onProgress, onAnswer);
    if (hasAnswer) onAnswer?.();
    return games;
  }

  /** The dashboard, and whether Steam answered a request made with the key for it. */
  private async readDashboard(
    owner: string,
    mode: DashboardMode,
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ games: IGameSummary[]; hasAnswer: boolean }> {
    const creds = this.credentials(owner);
    let hasAnswer = false;
    const onAnswer = (): void => {
      hasAnswer = true;
    };
    const played = Dashboard.played(
      await this.libraryOf(owner, mode !== 'cached', onAnswer),
    );

    const entries = new Map<number, ISummaryEntry>();
    const pending: IRawOwnedGame[] = [];
    for (const game of played) {
      const cached = this.store.getSummary(game.appid, owner);
      if (cached && mode !== 'all' && Dashboard.isCurrent(cached, game))
        entries.set(game.appid, cached);
      else pending.push(game);
    }

    let done = 0;
    const fresh: Record<string, ISummaryEntry> = {};
    // A failure stops the pool, which throws it once the reads in flight
    // ended: what they read is saved with the rest, for the next attempt.
    try {
      await Tracker.pool(pending, CONCURRENCY, async (game) => {
        const { entry, isLasting } = await this.readSummary(
          creds,
          game,
          onAnswer,
        );
        entries.set(game.appid, entry);
        if (isLasting) fresh[game.appid] = entry;
        done += 1;
        // The interface is showing another account's dashboard by then.
        if (this.owner() === owner) onProgress?.(done, pending.length);
      });
    } finally {
      this.store.setSummaries(fresh, owner);
    }

    const listed = played.filter(
      (game) => (entries.get(game.appid)?.total ?? 0) > 0,
    );
    const art = await this.art(listed.map((game) => game.appid));
    const games = Dashboard.closestFirst(
      listed.map((game) =>
        Dashboard.summary(game, entries.get(game.appid)!, art.get(game.appid)),
      ),
    );
    return { games, hasAnswer };
  }

  /**
   * What Steam says the player has in a game. A game without achievements
   * counts as read, and one Steam fails to answer for with an unknown error
   * keeps the summary it had; any other failure ends the whole read.
   */
  private async readSummary(
    creds: ICredentials,
    game: IRawOwnedGame,
    onAnswer: OnAnswer,
  ): Promise<{ entry: ISummaryEntry; isLasting: boolean }> {
    try {
      const list = await this.client.getPlayerAchievements(creds, game.appid);
      onAnswer();
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
      // A one-off Steam failure must not become "no achievements" in the
      // cache, nor take off the list a game that was read before: it stays
      // with what the store has of it, to be read again at the next attempt.
      const kept =
        e.kind === 'unknown'
          ? this.store.getSummary(game.appid, creds.steamId)
          : null;
      return {
        entry: kept ?? Dashboard.entry([], game.playtime_forever),
        isLasting: e.kind !== 'unknown',
      };
    }
  }

  /**
   * Runs the task over the items, at most `limit` of them at a time. Once a
   * task fails no other is started: the ones already running end first, and
   * then the first failure is thrown, so nothing is still running when the
   * caller hears of it.
   */
  private static async pool<T>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<void>,
  ): Promise<void> {
    const queue = [...items];
    const failures: unknown[] = [];
    const worker = async (): Promise<void> => {
      while (failures.length === 0) {
        const item = queue.shift();
        if (item === undefined) return;
        await task(item).catch((e: unknown) => failures.push(e));
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(limit, queue.length) }, worker),
    );
    if (failures.length > 0) throw failures[0];
  }
}
