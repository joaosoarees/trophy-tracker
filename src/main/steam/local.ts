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

/** What reading the local Steam client needs from the system. */
export interface ISteamLocalDeps {
  platform: NodeJS.Platform;
  /** Whether the Windows registry can be reached (Windows itself, or WSL). */
  hasWindows: boolean;
  home: string;
  exists: (path: string) => boolean;
  readFile: (path: string) => Promise<Buffer>;
  registry: {
    getRunningAppId: () => Promise<number | null>;
    getActiveSteamId: () => Promise<string | null>;
    getSteamPath: () => Promise<string | null>;
  };
}

const system = (): ISteamLocalDeps => ({
  platform: process.platform,
  hasWindows,
  home: homedir(),
  exists: existsSync,
  readFile: (path) => readFile(path),
  registry: {
    getRunningAppId: () => registryRunningAppId(),
    getActiveSteamId: () => registryActiveSteamId(),
    getSteamPath: () => registrySteamPath(),
  },
});

async function readStatMapFrom(
  steamDir: string | null,
  appid: number,
  deps: ISteamLocalDeps,
): Promise<Map<string, string>> {
  if (!steamDir) return new Map();
  try {
    const file = join(
      steamDir,
      'appcache',
      'stats',
      `UserGameStatsSchema_${appid}.bin`,
    );
    return achievementStatMap(parseBinaryVdf(await deps.readFile(file)));
  } catch {
    return new Map();
  }
}

/** Windows, natively or reached from WSL: the registry has everything. */
function createRegistrySteam(deps: ISteamLocalDeps): ISteamLocal {
  return {
    tracksRunningGame: true,
    getRunningAppId: deps.registry.getRunningAppId,
    getActiveSteamId: deps.registry.getActiveSteamId,
    readStatMap: async (appid) =>
      readStatMapFrom(await deps.registry.getSteamPath(), appid, deps),
  };
}

/**
 * macOS and Linux: there is no registry, so the account comes from the
 * client's files and the running game from the Web API (see `runningGame.ts`).
 */
function createFileSteam(deps: ISteamLocalDeps): ISteamLocal {
  const steamDir =
    steamDirCandidates(deps.platform, deps.home).find((dir) =>
      deps.exists(dir),
    ) ?? null;

  return {
    tracksRunningGame: false,
    getRunningAppId: () => Promise.resolve(null),
    getActiveSteamId: async () => {
      if (!steamDir) return null;
      try {
        const file = join(steamDir, 'config', 'loginusers.vdf');
        return mostRecentSteamId((await deps.readFile(file)).toString('utf8'));
      } catch {
        return null;
      }
    },
    readStatMap: (appid) => readStatMapFrom(steamDir, appid, deps),
  };
}

/** Every dependency defaults to the real system; tests pass their own. */
export function createSteamLocal(
  overrides: Partial<ISteamLocalDeps> = {},
): ISteamLocal {
  const deps = { ...system(), ...overrides };
  return deps.hasWindows ? createRegistrySteam(deps) : createFileSteam(deps);
}
