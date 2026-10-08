import { type IAppInfo, type IUpdateCheck } from '@shared/types/AppInfo';

const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;

export interface IAutoUpdaterListener {
  /** A newer version was found and its download started. */
  onDownloading: (version: string) => void;
  /** The download finished; restarting the app installs it. */
  onReady: (version: string) => void;
  onError: (detail: string) => void;
}

/** The part of the system that can download and install a new version by itself. */
export interface IAutoUpdater {
  start: (listener: IAutoUpdaterListener) => void;
  /** Looks for a newer version and, if there is one, downloads it. */
  check: () => Promise<unknown>;
  /** Closes the app, installs the downloaded version and opens it again. */
  install: () => void;
}

interface IAppUpdatesDeps {
  currentVersion: string;
  /** `null` where the app cannot update itself (macOS, a .deb install, development). */
  auto: IAutoUpdater | null;
  /** Finds out about a newer version without downloading anything. */
  checker: {
    getAppInfo: () => Promise<IAppInfo>;
    /** Asks right now; answers whether the check could be made. */
    check: () => Promise<boolean>;
  };
  onChange: (info: IAppInfo) => void;
  logError?: (source: string, detail: string) => void;
  now?: () => number;
}

/**
 * What the interface knows about new versions. Where the app can update
 * itself, the new version is downloaded in the background and installed when
 * the user asks to restart; nothing restarts on its own. Everywhere else, and
 * whenever the automatic path fails, the user is pointed to the download page.
 */
export class AppUpdates {
  private readonly currentVersion: string;
  private readonly auto: IAutoUpdater | null;
  private readonly checker: IAppUpdatesDeps['checker'];
  private readonly onChange: (info: IAppInfo) => void;
  private readonly now: () => number;
  private newVersion: string | null = null;
  private status: 'idle' | 'downloading' | 'ready' | 'failed' = 'idle';
  private checkedAt: number | null = null;

  constructor({
    currentVersion,
    auto,
    checker,
    onChange,
    logError,
    now = Date.now,
  }: IAppUpdatesDeps) {
    this.currentVersion = currentVersion;
    this.auto = auto;
    this.checker = checker;
    this.onChange = onChange;
    this.now = now;

    auto?.start({
      onDownloading: (version) => this.set(version, 'downloading'),
      onReady: (version) => this.set(version, 'ready'),
      onError: (detail) => {
        logError?.('main: auto-update', detail);
        this.fail();
      },
    });
  }

  async getAppInfo(): Promise<IAppInfo> {
    if (!this.auto || this.status === 'failed') {
      return this.checker.getAppInfo();
    }

    const isStale =
      this.checkedAt === null || this.now() - this.checkedAt > RECHECK_AFTER_MS;
    // A version already downloaded is not looked for again.
    if (isStale && this.status !== 'ready') {
      this.checkedAt = this.now();
      // Not awaited: the answer arrives through `onChange`.
      void this.auto.check().catch(() => this.fail());
    }
    return this.info();
  }

  /**
   * The check the user asks for: it ignores the six-hour wait and gives the
   * automatic update another chance if it had failed before.
   */
  async checkNow(): Promise<IUpdateCheck> {
    if (this.auto && this.status === 'ready') {
      return { ok: true, info: this.info() };
    }

    if (this.auto) {
      if (this.status === 'failed') this.status = 'idle';
      this.checkedAt = this.now();
      try {
        await this.auto.check();
      } catch {
        this.fail();
      }
      // A failure may also have arrived as an event while the check ran.
      if (this.currentStatus() !== 'failed') {
        return { ok: true, info: this.info() };
      }
    }

    const ok = await this.checker.check();
    return { ok, info: await this.checker.getAppInfo() };
  }

  /** Only does something once a version has finished downloading. */
  install(): void {
    if (this.status === 'ready') this.auto?.install();
  }

  /** Read through a method so a change made by an event is seen after an `await`. */
  private currentStatus(): AppUpdates['status'] {
    return this.status;
  }

  private info(): IAppInfo {
    return {
      version: this.currentVersion,
      newVersion: this.newVersion,
      updateStatus: this.status === 'ready' ? 'ready' : 'downloading',
    };
  }

  private set(version: string, status: 'downloading' | 'ready'): void {
    // A late progress event must not undo a finished download.
    if (this.status === 'ready' && status === 'downloading') return;
    this.newVersion = version;
    this.status = status;
    this.onChange(this.info());
  }

  /** From here on the user is offered the download page instead. */
  private fail(): void {
    if (this.status === 'failed') return;
    this.status = 'failed';
    void this.checker.getAppInfo().then(this.onChange, () => {});
  }
}
