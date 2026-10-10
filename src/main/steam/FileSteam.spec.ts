import { describe, expect, it } from 'vitest';

import { makeStatSchema } from '@tests/factories/makeStatSchema';
import { STEAM_ID } from '@tests/helpers';

import { FileSteam, type IFileSteamDeps } from './FileSteam';

const STEAM = '/home/me/.local/share/Steam';
const LOGIN_USERS_FILE = 'config/loginusers.vdf';
const STATS_FILE = 'appcache/stats/UserGameStatsSchema_10.bin';

const LOGIN_USERS = `"users"\n{\n\t"${STEAM_ID}"\n\t{\n\t\t"MostRecent"\t\t"1"\n\t}\n}\n`;

/**
 * The code joins paths with the separator of the system the tests run on;
 * the disk below is written with forward slashes on every system.
 */
const portable = (path: string) => path.replaceAll('\\', '/');

/** A Linux computer whose disk holds exactly the given files. */
function setup(
  files: Record<string, string | Buffer> = {},
  overrides: Partial<IFileSteamDeps> = {},
) {
  const read: string[] = [];
  const folders = new Set(
    Object.keys(files).flatMap((file) => {
      const parts = file.split('/');
      return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
    }),
  );
  const sut = new FileSteam({
    platform: 'linux',
    home: '/home/me',
    exists: (path) => folders.has(portable(path)),
    readFile: (systemPath) => {
      const path = portable(systemPath);
      read.push(path);
      return path in files
        ? Promise.resolve(Buffer.from(files[path]))
        : Promise.reject(new Error(`ENOENT: ${path}`));
    },
    ...overrides,
  });
  return { sut, read };
}

describe('FileSteam', () => {
  describe('canTrackRunningGame', () => {
    it('should be false when Steam is installed', () => {
      const { sut } = setup({ [`${STEAM}/${LOGIN_USERS_FILE}`]: LOGIN_USERS });

      const canTrack = sut.canTrackRunningGame;

      expect(canTrack).toBe(false);
    });
  });

  describe('getRunningAppId', () => {
    it('should answer null when Steam is installed', async () => {
      const { sut } = setup({ [`${STEAM}/${LOGIN_USERS_FILE}`]: LOGIN_USERS });

      const appId = await sut.getRunningAppId();

      expect(appId).toBeNull();
    });
  });

  describe('getActiveSteamId', () => {
    it("should answer the most recent account when the client's files name one", async () => {
      const { sut } = setup({ [`${STEAM}/${LOGIN_USERS_FILE}`]: LOGIN_USERS });

      const steamId = await sut.getActiveSteamId();

      expect(steamId).toBe(STEAM_ID);
    });

    it('should read the first folder that exists when Steam is not in the usual one', async () => {
      const flatpak = '/home/me/.var/app/com.valvesoftware.Steam/data/Steam';
      const { sut, read } = setup({
        [`${flatpak}/${LOGIN_USERS_FILE}`]: LOGIN_USERS,
      });

      await sut.getActiveSteamId();

      expect(read).toEqual([`${flatpak}/${LOGIN_USERS_FILE}`]);
    });

    it('should answer the account in the macOS folder when the system is a Mac', async () => {
      const mac = '/Users/me/Library/Application Support/Steam';
      const { sut } = setup(
        { [`${mac}/${LOGIN_USERS_FILE}`]: LOGIN_USERS },
        { platform: 'darwin', home: '/Users/me' },
      );

      const steamId = await sut.getActiveSteamId();

      expect(steamId).toBe(STEAM_ID);
    });

    it('should answer null without reading anything when Steam is not installed', async () => {
      const { sut, read } = setup();

      const steamId = await sut.getActiveSteamId();

      expect(steamId).toBeNull();
      expect(read).toEqual([]);
    });

    it('should answer null when the file cannot be read', async () => {
      const { sut } = setup({ [`${STEAM}/steam.sh`]: '' });

      const steamId = await sut.getActiveSteamId();

      expect(steamId).toBeNull();
    });
  });

  describe('readStatMap', () => {
    it("should link each achievement to its counter when the client's cache has the game", async () => {
      const { sut } = setup({
        [`${STEAM}/${STATS_FILE}`]: makeStatSchema(10, {
          ACH_KODAMA: 'KODAMA_COUNT',
        }),
      });

      const statMap = await sut.readStatMap(10);

      expect(statMap).toEqual(new Map([['ACH_KODAMA', 'KODAMA_COUNT']]));
    });

    it.each<{ problem: string; files: Record<string, string> }>([
      { problem: 'missing', files: { [`${STEAM}/steam.sh`]: '' } },
      {
        problem: 'corrupted',
        files: { [`${STEAM}/${STATS_FILE}`]: 'not a schema' },
      },
    ])(
      'should answer no counters when the cache file is $problem',
      async ({ files }) => {
        const { sut } = setup(files);

        const statMap = await sut.readStatMap(10);

        expect(statMap).toEqual(new Map());
      },
    );
  });
});
