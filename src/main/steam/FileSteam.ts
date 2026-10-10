import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { type ReadFile, SteamFiles } from './SteamFiles';
import { type ISteamLocal } from './SteamLocal';

/** What reading the client's folder needs from the system; tests pass their own. */
export interface IFileSteamDeps {
  platform: NodeJS.Platform;
  home: string;
  exists: (path: string) => boolean;
  readFile: ReadFile;
}

/**
 * macOS and Linux: there is no registry, so the account comes from the
 * client's files and the running game from the Web API (see `RunningGame`).
 */
export class FileSteam implements ISteamLocal {
  readonly canTrackRunningGame = false;
  private readonly steamDir: string | null;
  private readonly read: ReadFile;

  constructor(overrides: Partial<IFileSteamDeps> = {}) {
    const deps: IFileSteamDeps = {
      platform: process.platform,
      home: homedir(),
      exists: existsSync,
      readFile,
      ...overrides,
    };
    this.read = deps.readFile;
    this.steamDir =
      SteamFiles.dirCandidates(deps.platform, deps.home).find((dir) =>
        deps.exists(dir),
      ) ?? null;
  }

  getRunningAppId(): Promise<number | null> {
    return Promise.resolve(null);
  }

  async getActiveSteamId(): Promise<string | null> {
    if (!this.steamDir) return null;
    try {
      const file = join(this.steamDir, 'config', 'loginusers.vdf');
      return SteamFiles.mostRecentSteamId(
        (await this.read(file)).toString('utf8'),
      );
    } catch {
      return null;
    }
  }

  readStatMap(appid: number): Promise<Map<string, string>> {
    return SteamFiles.readStatMap(this.steamDir, appid, this.read);
  }
}
