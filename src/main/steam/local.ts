import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { mostRecentSteamId, steamDirCandidates } from './steamFiles';
import { achievementStatMap, parseBinaryVdf } from './vdf';
import {
  getActiveSteamId as registryActiveSteamId,
  getRunningAppId as registryRunningAppId,
  getSteamPath as registrySteamPath,
  hasWindows,
} from './windows';

/** What the app learns from the Steam client installed on this computer. */
export interface ISteamLocal {
  /**
   * Whether this system can tell which game is running without asking the
   * Web API. Only Windows can (through the registry).
   */
  tracksRunningGame: boolean;
  getRunningAppId: () => Promise<number | null>;
  /** SteamID64 of the account signed in to the client. */
  getActiveSteamId: () => Promise<string | null>;
  /** Which stat feeds each achievement's counter, from the client's cache. */
  readStatMap: (appid: number) => Promise<Map<string, string>>;
}

async function readStatMapFrom(
  steamDir: string | null,
  appid: number,
): Promise<Map<string, string>> {
  if (!steamDir) return new Map();
  try {
    const file = join(
      steamDir,
      'appcache',
      'stats',
      `UserGameStatsSchema_${appid}.bin`,
    );
    return achievementStatMap(parseBinaryVdf(await readFile(file)));
  } catch {
    return new Map();
  }
}

/** Windows, natively or reached from WSL: the registry has everything. */
function createRegistrySteam(): ISteamLocal {
  return {
    tracksRunningGame: true,
    getRunningAppId: registryRunningAppId,
    getActiveSteamId: registryActiveSteamId,
    readStatMap: async (appid) =>
      readStatMapFrom(await registrySteamPath(), appid),
  };
}

/**
 * macOS and Linux: there is no registry, so the account comes from the
 * client's files and the running game from the Web API (see `runningGame.ts`).
 */
function createFileSteam(platform: NodeJS.Platform): ISteamLocal {
  const steamDir =
    steamDirCandidates(platform, homedir()).find((dir) => existsSync(dir)) ??
    null;

  return {
    tracksRunningGame: false,
    getRunningAppId: () => Promise.resolve(null),
    getActiveSteamId: async () => {
      if (!steamDir) return null;
      try {
        return mostRecentSteamId(
          await readFile(join(steamDir, 'config', 'loginusers.vdf'), 'utf8'),
        );
      } catch {
        return null;
      }
    },
    readStatMap: (appid) => readStatMapFrom(steamDir, appid),
  };
}

export function createSteamLocal(
  platform: NodeJS.Platform = process.platform,
): ISteamLocal {
  return hasWindows ? createRegistrySteam() : createFileSteam(platform);
}
