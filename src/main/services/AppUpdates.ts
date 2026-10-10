import { type IAppInfo, type IUpdateCheck } from '@shared/types/AppInfo';
import { isNewerVersion } from '@shared/version';

import { UpdateChecker } from './UpdateChecker';

export interface IAutoUpdaterListener {
  /** How much of the new version has been downloaded, from 0 to 100. */
  onProgress: (percent: number) => void;
  /** The download finished; installing it restarts the app. */
  onReady: (version: string) => void;
  onError: (detail: string) => void;
}

/** The part of the system that can download and install a new version by itself. */
export interface IAutoUpdater {
  start: (listener: IAutoUpdaterListener) => void;
  /** The latest version published, or `null` when there is none. Downloads nothing. */
  check: () => Promise<string | null>;
  /** Downloads the version the last check found. */
  download: () => Promise<unknown>;
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
  /**
   * Whether this system would refuse to run the installer of a new version
   * (Windows with Smart App Control on, while the installers are unsigned).
   * Asked once.
   */
  isInstallBlocked?: () => Promise<boolean>;
  /** The version the app last closed itself to install, kept across restarts. */
  attempt?: {
    get: () => string | null;
    set: (version: string | null) => void;
  };
  onChange: (info: IAppInfo) => void;
  logError?: (source: string, detail: string) => void;
  now?: () => number;
}

/**
 * What the interface knows about new versions. Where the app can update
 * itself, a new version is downloaded as soon as it is found and installed
 * when the interface asks (it decides when a restart is acceptable).
 * Everywhere else, and whenever the automatic path fails, the user is pointed
 * to the download page.
 */
export class AppUpdates {
  private readonly currentVersion: string;
  private readonly auto: IAutoUpdater | null;
  private readonly checker: IAppUpdatesDeps['checker'];
  private readonly onChange: (info: IAppInfo) => void;
  private readonly now: () => number;
  private readonly isInstallBlocked: () => Promise<boolean>;
  private readonly attempt: IAppUpdatesDeps['attempt'];
  /**
   * A version the app already closed itself to install and that is still not
   * the running one: installing it failed. Trying again on every start would
   * close the app in a loop, so that version is only offered for download.
   */
  private readonly failedInstall: string | null;
  private blocked: Promise<boolean> | null = null;
  private looking: Promise<void> | null = null;
  private newVersion: string | null = null;
  private percent = 0;
  private status: 'idle' | 'downloading' | 'ready' | 'failed' = 'idle';
  private checkedAt: number | null = null;

  constructor({
    currentVersion,
    auto,
    checker,
    isInstallBlocked = () => Promise.resolve(false),
    attempt,
    onChange,
    logError,
    now = Date.now,
  }: IAppUpdatesDeps) {
    this.currentVersion = currentVersion;
    this.auto = auto;
    this.checker = checker;
    this.onChange = onChange;
    this.now = now;
    this.isInstallBlocked = isInstallBlocked;
    this.attempt = attempt;

    const attempted = attempt?.get() ?? null;
    this.failedInstall =
      attempted !== null && isNewerVersion(attempted, currentVersion)
        ? attempted
        : null;
    // The attempt worked (or was for a version since left behind): forget it.
    if (attempted !== null && this.failedInstall === null) attempt?.set(null);

    auto?.start({
      onProgress: (percent) => this.progress(percent),
      onReady: (version) => {
        this.newVersion = version;
        this.status = 'ready';
        this.onChange(this.info());
      },
      onError: (detail) => {
        logError?.('main: auto-update', detail);
        this.fail();
      },
    });
  }

  async getAppInfo(): Promise<IAppInfo> {
    if (await this.cannotInstall()) {
      return this.asBlocked(await this.checker.getAppInfo());
    }
    if (!this.auto || this.status === 'failed') {
      return this.checker.getAppInfo();
    }

    const isDue = UpdateChecker.isDue(this.checkedAt, this.now());
    if (isDue && this.status === 'idle') {
      // Not awaited: what it finds arrives through `onChange`.
      void this.look();
    }
    return this.info();
  }

  /**
   * A check that waits for the answer: the one made when the app opens and
   * the one the user asks for. It ignores the six-hour wait and gives the
   * automatic update another chance if it had failed before.
   */
  async checkNow(): Promise<IUpdateCheck> {
    if (await this.cannotInstall()) {
      const ok = await this.checker.check();
      return { ok, info: this.asBlocked(await this.checker.getAppInfo()) };
    }

    if (this.auto) {
      if (this.status === 'failed') this.status = 'idle';
      if (this.status === 'idle') await this.look();
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
    if (this.status !== 'ready' || !this.auto) return;
    this.attempt?.set(this.newVersion);
    this.auto.install();
  }

  /** Looks for a newer version and starts downloading it; simultaneous calls share one look. */
  private look(): Promise<void> {
    this.looking ??= this.lookOnce().finally(() => (this.looking = null));
    return this.looking;
  }

  private async lookOnce(): Promise<void> {
    if (!this.auto) return;
    this.checkedAt = this.now();
    try {
      const version = await this.auto.check();
      if (version === null || !isNewerVersion(version, this.currentVersion)) {
        return;
      }
      if (version === this.failedInstall) {
        this.fail();
        return;
      }
      this.newVersion = version;
      this.percent = 0;
      this.status = 'downloading';
      this.onChange(this.info());
      // Not awaited: progress and the end arrive as events.
      void this.auto.download().catch(() => this.fail());
    } catch {
      this.fail();
    }
  }

  private progress(percent: number): void {
    if (this.status !== 'downloading') return;
    const whole = Math.max(0, Math.min(100, Math.floor(percent)));
    // The updater reports several times a second; the interface only needs
    // to hear when the number it shows changes.
    if (whole === this.percent) return;
    this.percent = whole;
    this.onChange(this.info());
  }

  /**
   * Downloading a version and closing the app to install it would lead
   * nowhere, so the user is only told about it. Unknown counts as not blocked.
   */
  private cannotInstall(): Promise<boolean> {
    if (!this.auto) return Promise.resolve(false);
    this.blocked ??= this.isInstallBlocked().catch(() => false);
    return this.blocked;
  }

  private asBlocked(info: IAppInfo): IAppInfo {
    return { ...info, updateStatus: 'blocked' };
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
      downloadPercent: this.status === 'downloading' ? this.percent : null,
    };
  }

  /** From here on the user is offered the download page instead. */
  private fail(): void {
    if (this.status === 'failed') return;
    this.status = 'failed';
    void this.checker.getAppInfo().then(this.onChange, () => {});
  }
}
