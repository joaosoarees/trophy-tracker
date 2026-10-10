import { describe, expect, it } from 'vitest';

import { makeStatSchema } from '@tests/factories/makeStatSchema';
import { STEAM_ID } from '@tests/helpers';

import { RegistrySteam } from './RegistrySteam';

const STATS_FILE = '/mnt/c/steam/appcache/stats/UserGameStatsSchema_10.bin';

interface ISetupOverrides {
  /** Where the registry says Steam is; by default, `/mnt/c/steam`. */
  steamPath?: string | null;
  /** What reading the signed-in account does; by default, it answers `STEAM_ID`. */
  getActiveSteamId?: () => Promise<string | null>;
}

/**
 * The code joins paths with the separator of the system the tests run on;
 * the disk below is written with forward slashes on every system.
 */
const portable = (path: string) => path.replaceAll('\\', '/');

/**
 * A Windows with a game running and an account signed in, whose disk holds
 * exactly the given files.
 */
function setup(
  files: Record<string, Buffer> = {},
  {
    steamPath = '/mnt/c/steam',
    getActiveSteamId = () => Promise.resolve(STEAM_ID),
  }: ISetupOverrides = {},
) {
  const read: string[] = [];
  const sut = new RegistrySteam(
    {
      getRunningAppId: () => Promise.resolve(2638890),
      getActiveSteamId,
      getSteamPath: () => Promise.resolve(steamPath),
    },
    (systemPath) => {
      const path = portable(systemPath);
      read.push(path);
      return path in files
        ? Promise.resolve(files[path])
        : Promise.reject(new Error(`ENOENT: ${path}`));
    },
  );
  return { sut, read };
}

describe('RegistrySteam', () => {
  describe('canTrackRunningGame', () => {
    it('should be true when the registry is what it reads', () => {
      const { sut } = setup();

      const canTrack = sut.canTrackRunningGame;

      expect(canTrack).toBe(true);
    });
  });

  describe('getRunningAppId', () => {
    it('should answer the game in the registry when one is running', async () => {
      const { sut } = setup();

      const appId = await sut.getRunningAppId();

      expect(appId).toBe(2638890);
    });
  });

  describe('getActiveSteamId', () => {
    it('should answer the account in the registry when one is signed in', async () => {
      const { sut } = setup();

      const steamId = await sut.getActiveSteamId();

      expect(steamId).toBe(STEAM_ID);
    });

    it('should fail instead of answering nobody when the registry cannot be read', async () => {
      const { sut } = setup(
        {},
        {
          getActiveSteamId: () =>
            Promise.reject(new Error('reg.exe could not be started')),
        },
      );

      const steamIdPromise = sut.getActiveSteamId();

      await expect(steamIdPromise).rejects.toThrow(
        new Error('reg.exe could not be started'),
      );
    });
  });

  describe('readStatMap', () => {
    it('should link each achievement to its counter when the folder the registry points to has the game', async () => {
      const { sut } = setup({
        [STATS_FILE]: makeStatSchema(10, { ACH_KODAMA: 'KODAMA_COUNT' }),
      });

      const statMap = await sut.readStatMap(10);

      expect(statMap).toEqual(new Map([['ACH_KODAMA', 'KODAMA_COUNT']]));
    });

    it('should answer no counters without reading anything when the registry does not say where Steam is', async () => {
      const { sut, read } = setup(
        { [STATS_FILE]: makeStatSchema(10, { ACH_KODAMA: 'KODAMA_COUNT' }) },
        { steamPath: null },
      );

      const statMap = await sut.readStatMap(10);

      expect(statMap).toEqual(new Map());
      expect(read).toEqual([]);
    });
  });
});
