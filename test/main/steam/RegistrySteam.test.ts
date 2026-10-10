import { describe, expect, it } from 'vitest';

import { RegistrySteam } from '@main/steam/RegistrySteam';
import { makeStatSchema } from '@test/factories/makeStatSchema';
import { STEAM_ID } from '@test/helpers';

/**
 * The code joins paths with the separator of the system the tests run on;
 * the disk below is written with forward slashes on every system.
 */
const portable = (path: string) => path.replaceAll('\\', '/');

const REGISTRY = {
  getRunningAppId: () => Promise.resolve(2638890),
  getActiveSteamId: () => Promise.resolve(STEAM_ID),
  getSteamPath: () => Promise.resolve<string | null>('/mnt/c/steam'),
};

/** A Windows whose registry says the above and whose disk holds exactly the given files. */
function setup(files: Record<string, Buffer> = {}, registry = REGISTRY) {
  const read: string[] = [];
  const local = new RegistrySteam(registry, (systemPath) => {
    const path = portable(systemPath);
    read.push(path);
    return path in files
      ? Promise.resolve(files[path])
      : Promise.reject(new Error(`ENOENT: ${path}`));
  });
  return { local, read };
}

describe('RegistrySteam', () => {
  it('can tell which game is running without asking the Web API', async () => {
    const { local } = setup();

    expect(local.canTrackRunningGame).toBe(true);
    expect(await local.getRunningAppId()).toBe(2638890);
  });

  it('takes the signed-in account from the registry', async () => {
    const { local } = setup();

    expect(await local.getActiveSteamId()).toBe(STEAM_ID);
  });

  it("reads a game's counters from the folder the registry points to", async () => {
    const file = '/mnt/c/steam/appcache/stats/UserGameStatsSchema_10.bin';
    const { local } = setup({
      [file]: makeStatSchema(10, { ACH_KODAMA: 'KODAMA_COUNT' }),
    });

    expect([...(await local.readStatMap(10))]).toEqual([
      ['ACH_KODAMA', 'KODAMA_COUNT'],
    ]);
  });

  it('has no counters when the registry does not say where Steam is', async () => {
    const { local, read } = setup(
      {},
      { ...REGISTRY, getSteamPath: () => Promise.resolve(null) },
    );

    expect((await local.readStatMap(10)).size).toBe(0);
    expect(read).toEqual([]);
  });
});
