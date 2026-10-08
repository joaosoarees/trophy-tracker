import { type IAppInfo } from '@shared/types/AppInfo';
import { isNewerVersion } from '@shared/version';

const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;

interface IUpdateCheckerDeps {
  currentVersion: string;
  /** `owner/name` of the GitHub repository that publishes the releases. */
  repository: string;
  fetchImpl?: typeof fetch;
  /** Where GitHub's API is; only the interface audit points it elsewhere. */
  apiBase?: string;
  now?: () => number;
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
  private newVersion: string | null = null;
  private checkedAt: number | null = null;
  private running: Promise<boolean> | null = null;

  constructor({
    currentVersion,
    repository,
    fetchImpl = fetch,
    apiBase = 'https://api.github.com',
    now = Date.now,
  }: IUpdateCheckerDeps) {
    this.currentVersion = currentVersion;
    this.url = `${apiBase}/repos/${repository}/releases/latest`;
    this.fetchImpl = fetchImpl;
    this.now = now;
  }

  async getAppInfo(): Promise<IAppInfo> {
    const isStale =
      this.checkedAt === null || this.now() - this.checkedAt > RECHECK_AFTER_MS;
    if (isStale) await this.check();
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
        signal: AbortSignal.timeout(10_000),
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
