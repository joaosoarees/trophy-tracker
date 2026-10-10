import { type CheckResult } from '@shared/types/Check';
import { type CurrentGame, type IGameView } from '@shared/types/Game';

const RUNNING_CHECK_MS = 10_000;
const UNLOCK_CHECK_MS = 60_000;

export interface IGameWatcherDeps {
  /** AppID of the game running on Steam, or `null`. */
  getRunningAppId: () => Promise<number | null>;
  lastPlayedAppId: () => Promise<number | null>;
  /**
   * A game has started: puts the app on the account that is playing it.
   * Answers `other` when that account is not one the app has, and `refused`
   * when it is one the app could not be put on (the disk refused the write).
   * It does not reject: a check has nobody to tell.
   */
  followRunningGame?: () => Promise<'followed' | 'other' | 'refused'>;
  /** Light re-read of a game while it is being played. */
  pollGame: (appid: number) => Promise<CheckResult<IGameView>>;
  isConfigured: () => boolean;
  onCurrentChanged: (current: CurrentGame) => void;
  onGameUpdated: (view: IGameView) => void;
  /** How often each check runs, in milliseconds; the defaults are what users get. */
  intervals?: { running: number; unlocks: number };
  /**
   * Runs `run` every `ms` milliseconds and answers the function that stops
   * it; the default is the system's timer.
   */
  every?: (run: () => void, ms: number) => () => void;
}

/**
 * Follows the game open on Steam: tells the interface when it changes and
 * keeps its view fresh while it is being played. What was just unlocked is
 * shown by the interface, which compares the views; Steam's own notification
 * covers the system side.
 */
export class GameWatcher {
  private current: CurrentGame = null;
  /** Last view of the current game the interface has seen. */
  private lastView: IGameView | null = null;
  /** The game last seen running since the app opened. */
  private lastSeenRunning: number | null = null;

  /**
   * How many times the current game was forgotten. What was being observed
   * when that happened is the game of the account that was left.
   */
  private forgotten = 0;

  /**
   * The checks that have not ended, by name, each with how many times the
   * current game had been forgotten as it began.
   */
  private readonly inFlight = new Map<
    string,
    { forgotten: number; done: Promise<void> }
  >();

  /** What stops each periodic check; empty while the watcher is stopped. */
  private stops: (() => void)[] = [];

  constructor(private deps: IGameWatcherDeps) {}

  /** Starts the two periodic checks; does nothing when they already run. */
  start(): void {
    if (this.stops.length > 0) return;

    const { running, unlocks } = this.deps.intervals ?? {
      running: RUNNING_CHECK_MS,
      unlocks: UNLOCK_CHECK_MS,
    };
    const every = this.deps.every ?? GameWatcher.everyInterval;
    this.stops = [
      every(() => void this.checkRunningGame(), running),
      every(() => void this.checkUnlocks(), unlocks),
    ];
  }

  /** Ends the two periodic checks; `start` begins them again. */
  stop(): void {
    for (const stop of this.stops) stop();
    this.stops = [];
  }

  /**
   * Game open on Steam or, with no game open, the last one played. Not a plain
   * query: when a game starts it puts the app on the account playing it, and
   * it records the game seen running as the last one played. A game whose
   * account the app could not be put on is not the game of the account in
   * use: that account is answered for as with no game open, and since the
   * game is not taken as running, the next look asks whose it is again.
   */
  private async observe(): Promise<CurrentGame> {
    const running = await this.deps.getRunningAppId();
    if (running !== null) {
      // Whose game it is only has to be asked when the game starts.
      const isSameGame =
        this.current?.isRunning === true && this.current.appid === running;
      const whose = isSameGame ? null : await this.deps.followRunningGame?.();
      const isOnAnotherAccount = isSameGame
        ? this.current?.isOnAnotherAccount === true
        : whose === 'other';
      // Not this account's game: it is not what was "last played" here.
      if (isOnAnotherAccount) {
        return { appid: running, isRunning: true, isOnAnotherAccount: true };
      }
      if (whose !== 'refused') {
        this.lastSeenRunning = running;
        return { appid: running, isRunning: true };
      }
    }
    if (!this.deps.isConfigured()) return null;
    // A game seen closing is the last one played, whatever the library read
    // before it was started still says.
    if (this.lastSeenRunning !== null) {
      return { appid: this.lastSeenRunning, isRunning: false };
    }

    const last = await this.deps.lastPlayedAppId().catch(() => null);
    return last === null ? null : { appid: last, isRunning: false };
  }

  /**
   * While a game is being played the app stays on the account playing it:
   * following another one would show the game with the wrong achievements.
   */
  get isPlaying(): boolean {
    return this.current?.isRunning === true && !this.current.isOnAnotherAccount;
  }

  /** Resolves the current game and remembers it without announcing a change. */
  async refreshCurrent(): Promise<CurrentGame> {
    const forgotten = this.forgotten;
    const current = await this.observe();
    // Another account took over meanwhile: its game is the one to answer.
    if (forgotten !== this.forgotten) return this.refreshCurrent();
    this.current = current;
    return this.current;
  }

  /** The interface has just been given this view; unlocks are measured against it. */
  remember(view: IGameView): void {
    if (this.current?.appid === view.appid) this.lastView = view;
  }

  /** Drops what was read: language changed or the setup was erased. */
  forget({ isCurrentIncluded = false } = {}): void {
    this.lastView = null;
    if (isCurrentIncluded) {
      this.current = null;
      this.lastSeenRunning = null;
      this.forgotten += 1;
    }
  }

  /**
   * Looks for the game open on Steam and tells the interface when it changed.
   * One check at a time: a check waits on Steam, for longer than the time
   * between two of them when Steam does not answer, and a second one beside
   * it would see what the first is still acting on, a game that closed
   * included, and announce it again.
   */
  checkRunningGame(): Promise<void> {
    return this.once('running', async () => {
      const forgotten = this.forgotten;
      const next = await this.observe();
      // Another account took over meanwhile: the next check looks for its game.
      if (forgotten !== this.forgotten) return;
      const previous = this.current;
      if (!GameWatcher.hasChanged(previous, next)) return;

      // The game was closed: one last read catches what was unlocked in the final minute.
      if (GameWatcher.hasStoppedPlaying(previous, next)) {
        await this.checkUnlocks();
        if (forgotten !== this.forgotten) return;
      }

      this.current = next;
      this.lastView = null;
      this.deps.onCurrentChanged(next);
    });
  }

  /**
   * Reads the game being played and hands the interface what changed. One
   * read of a game at a time, so two can never answer out of order.
   */
  async checkUnlocks(): Promise<void> {
    if (!this.current?.isRunning || this.current.isOnAnotherAccount) return;
    if (!this.deps.isConfigured()) return;

    const { appid } = this.current;
    return this.once(`unlocks:${appid}`, async () => {
      const forgotten = this.forgotten;
      const result = await this.deps.pollGame(appid);
      // Another account took over meanwhile: the view is of the one that was
      // left, even when this one is on the same game by now.
      if (forgotten !== this.forgotten) return;
      if (!result.ok || this.current?.appid !== appid) return;

      const view = result.value;
      // The same object comes back when nothing changed; then there is nothing to announce.
      if (view === this.lastView) return;

      this.lastView = view;
      this.deps.onGameUpdated(view);
    });
  }

  /**
   * Runs a check unless the one of that name has not ended, which then
   * answers for this one too. A check begun before the current game was
   * forgotten is not waited for: it is for the account that was left, and
   * drops what it finds.
   */
  private once(name: string, check: () => Promise<void>): Promise<void> {
    const running = this.inFlight.get(name);
    if (running?.forgotten === this.forgotten) return running.done;

    const flight = {
      forgotten: this.forgotten,
      done: check().finally(() => {
        if (this.inFlight.get(name) === flight) this.inFlight.delete(name);
      }),
    };
    this.inFlight.set(name, flight);
    return flight.done;
  }

  private static everyInterval(
    this: void,
    run: () => void,
    ms: number,
  ): () => void {
    const handle = setInterval(run, ms);
    return () => clearInterval(handle);
  }

  /** Whether the interface has to be told about another current game. */
  private static hasChanged(previous: CurrentGame, next: CurrentGame): boolean {
    return (
      next?.appid !== previous?.appid ||
      next?.isRunning !== previous?.isRunning ||
      next?.isOnAnotherAccount !== previous?.isOnAnotherAccount
    );
  }

  /** Whether the game that was running is no longer the one being played. */
  private static hasStoppedPlaying(
    previous: CurrentGame,
    next: CurrentGame,
  ): boolean {
    const isStillRunning =
      next?.isRunning === true && next.appid === previous?.appid;
    return previous?.isRunning === true && !isStillRunning;
  }
}
