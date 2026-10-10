import { describe, expect, it } from 'vitest';

import { FileSteam, type IFileSteamDeps } from '@main/steam/FileSteam';
import { makeStatSchema } from '@test/factories/makeStatSchema';
import { STEAM_ID } from '@test/helpers';

const LOGIN_USERS = `"users"\n{\n\t"${STEAM_ID}"\n\t{\n\t\t"MostRecent"\t\t"1"\n\t}\n}\n`;

/**
 * The code joins paths with the separator of the system the tests run on;
 * the disk below is written with forward slashes on every system.
 */
const portable = (path: string) => path.replaceAll('\\', '/');

/** A computer whose disk holds exactly the given files. */
function setup(
  files: Record<string, string | Buffer> = {},
  over: Partial<IFileSteamDeps> = {},
) {
  const read: string[] = [];
  const folders = new Set(
    Object.keys(files).flatMap((file) => {
      const parts = file.split('/');
      return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
    }),
  );
  const local = new FileSteam({
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
    ...over,
  });
  return { local, read };
}

describe('FileSteam', () => {
  const steam = '/home/me/.local/share/Steam';

  it('cannot tell which game is running by itself', async () => {
    const { local } = setup({
      [`${steam}/config/loginusers.vdf`]: LOGIN_USERS,
    });

    expect(local.canTrackRunningGame).toBe(false);
    expect(await local.getRunningAppId()).toBeNull();
  });

  it("takes the signed-in account from the client's files", async () => {
    const { local } = setup({
      [`${steam}/config/loginusers.vdf`]: LOGIN_USERS,
    });

    expect(await local.getActiveSteamId()).toBe(STEAM_ID);
  });

  it('looks in the first folder where Steam is actually installed', async () => {
    const flatpak = '/home/me/.var/app/com.valvesoftware.Steam/data/Steam';
    const { local, read } = setup({
      [`${flatpak}/config/loginusers.vdf`]: LOGIN_USERS,
    });

    await local.getActiveSteamId();

    expect(read).toEqual([`${flatpak}/config/loginusers.vdf`]);
  });

  it('uses the macOS folder on a Mac', async () => {
    const mac = '/Users/me/Library/Application Support/Steam';
    const { local } = setup(
      { [`${mac}/config/loginusers.vdf`]: LOGIN_USERS },
      { platform: 'darwin', home: '/Users/me' },
    );

    expect(await local.getActiveSteamId()).toBe(STEAM_ID);
  });

  it('knows no account when Steam is not installed', async () => {
    const { local, read } = setup();

    expect(await local.getActiveSteamId()).toBeNull();
    expect(read).toEqual([]);
  });

  it('knows no account when the file cannot be read', async () => {
    const { local } = setup({ [`${steam}/steam.sh`]: '' });

    expect(await local.getActiveSteamId()).toBeNull();
  });

  it("reads a game's counters from the client's cache", async () => {
    const { local } = setup({
      [`${steam}/appcache/stats/UserGameStatsSchema_10.bin`]: makeStatSchema(
        10,
        { ACH_KODAMA: 'KODAMA_COUNT' },
      ),
    });

    expect((await local.readStatMap(10)).get('ACH_KODAMA')).toBe(
      'KODAMA_COUNT',
    );
  });

  it.each<{ problem: string; files: Record<string, string> }>([
    { problem: 'missing', files: { [`${steam}/steam.sh`]: '' } },
    {
      problem: 'corrupted',
      files: {
        [`${steam}/appcache/stats/UserGameStatsSchema_10.bin`]: 'not a schema',
      },
    },
  ])('has no counters when the cache file is $problem', async ({ files }) => {
    const { local } = setup(files);

    expect((await local.readStatMap(10)).size).toBe(0);
  });
});
