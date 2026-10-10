import { readFile } from 'node:fs/promises';

import { type ReadFile, SteamFiles } from './SteamFiles';
import { type ISteamLocal } from './SteamLocal';
import { Windows } from './Windows';

/** The part of `Windows` this reads the registry through. */
type Registry = Pick<
  Windows,
  'getRunningAppId' | 'getActiveSteamId' | 'getSteamPath'
>;

/** Windows, natively or reached from WSL: the registry has everything. */
export class RegistrySteam implements ISteamLocal {
  readonly canTrackRunningGame = true;

  constructor(
    private readonly registry: Registry = new Windows(),
    private readonly read: ReadFile = readFile,
  ) {}

  getRunningAppId(): Promise<number | null> {
    return this.registry.getRunningAppId();
  }

  getActiveSteamId(): Promise<string | null> {
    return this.registry.getActiveSteamId();
  }

  async readStatMap(appid: number): Promise<Map<string, string>> {
    return SteamFiles.readStatMap(
      await this.registry.getSteamPath(),
      appid,
      this.read,
    );
  }
}
