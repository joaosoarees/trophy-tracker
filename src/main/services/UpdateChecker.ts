import { type IAppInfo } from '@shared/types/AppInfo';
import { isNewerVersion } from '@shared/version';

const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

interface IUpdateCheckerDeps {
  currentVersion: string;
  /** `owner/name` of the GitHub repository that publishes the releases. */
  repository: string;
  fetchImpl?: typeof fetch;
  /** Where GitHub's API is; only the interface audit points it elsewhere. */
  apiBase?: string;
  now?: () => number;
  /** The signal that gives up on a request GitHub does not answer in time. */
  timeout?: () => AbortSignal;
}

/**
 * Asks GitHub for the latest published release, at most once every few hours.
 * It only tells the user; downloading and installing stay with them (see
 * `AppUpdates` for the systems where the app updates itself). Any failure
 * (offline, no release yet, rate limit) means "nothing new".
 */
export class UpdateChecker {
  private readonly currentVersion: string;
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly timeout: () => AbortSignal;
  private newVersion: string | null = null;
  private checkedAt: number | null = null;
  private running: Promise<boolean> | null = null;

  constructor({
    currentVersion,
    repository,
    fetchImpl = fetch,
    apiBase = 'https://api.github.com',
    now = Date.now,
    timeout = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }: IUpdateCheckerDeps) {
    this.currentVersion = currentVersion;
    this.url = `${apiBase}/repos/${repository}/releases/latest`;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.timeout = timeout;
  }

  /**
   * Whether a check last made at `checkedAt` (`null`: never) should be made
   * again at `now`: only once more than six hours have passed.
   */
  static isDue(checkedAt: number | null, now: number): boolean {
    return checkedAt === null || now - checkedAt > RECHECK_AFTER_MS;
  }

  async getAppInfo(): Promise<IAppInfo> {
    if (UpdateChecker.isDue(this.checkedAt, this.now())) await this.check();
    return {
      version: this.currentVersion,
      newVersion: this.newVersion,
      updateStatus: 'manual',
      downloadPercent: null,
    };
  }

  /**
   * Asks GitHub now, whenever the last check was. Answers whether the check
   * could be made; simultaneous calls share one request.
   */
  check(): Promise<boolean> {
    this.running ??= this.ask().finally(() => (this.running = null));
    return this.running;
  }

  private async ask(): Promise<boolean> {
    let ok = false;
    try {
      const res = await this.fetchImpl(this.url, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: this.timeout(),
      });
      if (res.ok) {
        const release = (await res.json()) as { tag_name?: string };
        const tag = release.tag_name?.replace(/^v/, '') ?? '';
        this.newVersion = isNewerVersion(tag, this.currentVersion) ? tag : null;
        ok = true;
      }
    } catch {
      // Keeps whatever the last successful check found.
    }
    this.checkedAt = this.now();
    return ok;
  }
}
