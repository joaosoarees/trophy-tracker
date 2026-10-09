import { type CheckResult } from '@shared/types/Check';
import { type CurrentGame, type IGameView } from '@shared/types/Game';

const RUNNING_CHECK_MS = 10_000;
const UNLOCK_CHECK_MS = 60_000;

export interface IGameWatcherDeps {
  /** AppID of the game running on Steam, or `null`. */
  getRunningAppId: () => Promise<number | null>;
  lastPlayedAppId: () => Promise<number | null>;
  /** Light re-read of a game while it is being played. */
  pollGame: (appid: number) => Promise<CheckResult<IGameView>>;
  isConfigured: () => boolean;
  onCurrentChanged: (current: CurrentGame) => void;
  onGameUpdated: (view: IGameView) => void;
  /** How often each check runs, in milliseconds; the defaults are what users get. */
  intervals?: { running: number; unlocks: number };
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

  constructor(private deps: IGameWatcherDeps) {}

  start(): void {
    const { running, unlocks } = this.deps.intervals ?? {
      running: RUNNING_CHECK_MS,
      unlocks: UNLOCK_CHECK_MS,
    };
    setInterval(() => void this.checkRunningGame(), running);
    setInterval(() => void this.checkUnlocks(), unlocks);
  }

  /** Game open on Steam or, with no game open, the last one played. */
  async resolveCurrent(): Promise<CurrentGame> {
    const running = await this.deps.getRunningAppId();
    if (running !== null) return { appid: running, running: true };
    if (!this.deps.isConfigured()) return null;

    const last = await this.deps.lastPlayedAppId().catch(() => null);
    return last === null ? null : { appid: last, running: false };
  }

  /** Resolves the current game and remembers it without announcing a change. */
  async refreshCurrent(): Promise<CurrentGame> {
    this.current = await this.resolveCurrent();
    return this.current;
  }

  /** The interface has just been given this view; unlocks are measured against it. */
  remember(view: IGameView): void {
    if (this.current?.appid === view.appid) this.lastView = view;
  }

  /** Drops what was read: language changed or the setup was erased. */
  forget({ current = false } = {}): void {
    this.lastView = null;
    if (current) this.current = null;
  }

  async checkRunningGame(): Promise<void> {
    const next = await this.resolveCurrent();
    const previous = this.current;
    if (
      next?.appid === previous?.appid &&
      next?.running === previous?.running
    ) {
      return;
    }

    // The game was closed: one last read catches what was unlocked in the final minute.
    const stillRunning = next?.running && next.appid === previous?.appid;
    if (previous?.running && !stillRunning) await this.checkUnlocks();

    this.current = next;
    this.lastView = null;
    this.deps.onCurrentChanged(next);
  }

  async checkUnlocks(): Promise<void> {
    if (!this.current?.running || !this.deps.isConfigured()) return;

    const { appid } = this.current;
    const result = await this.deps.pollGame(appid);
    if (!result.ok || this.current?.appid !== appid) return;

    const view = result.value;
    // The same object comes back when nothing changed; then there is nothing to announce.
    if (view === this.lastView) return;

    this.lastView = view;
    this.deps.onGameUpdated(view);
  }
}
