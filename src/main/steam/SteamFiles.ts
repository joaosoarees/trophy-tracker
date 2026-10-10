import { join, posix } from 'node:path';

import { isSteamId } from '@shared/validation';

import { BinaryVdf } from './BinaryVdf';
import { type ITextVdf, TextVdf } from './TextVdf';

export type ReadFile = (path: string) => Promise<Buffer>;

const isBlock = (value: string | ITextVdf | undefined): value is ITextVdf =>
  typeof value === 'object';

/** What is read from the Steam client's own folder. */
export class SteamFiles {
  /** Where the Steam client may be installed, most likely first. */
  static dirCandidates(platform: NodeJS.Platform, home: string): string[] {
    // The platform is an argument, so the separator must not depend on the
    // system this code happens to run on.
    const { join } = posix;
    switch (platform) {
      case 'darwin':
        return [join(home, 'Library', 'Application Support', 'Steam')];
      case 'linux':
        return [
          join(home, '.local', 'share', 'Steam'),
          join(home, '.steam', 'steam'),
          // Flatpak and Snap keep their own home.
          join(home, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam'),
          join(home, 'snap', 'steam', 'common', '.local', 'share', 'Steam'),
        ];
      case 'win32':
        return ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam'];
      default:
        return [];
    }
  }

  /**
   * SteamID64 of the account last signed in, from `config/loginusers.vdf`.
   * The file lists every account that signed in on this computer; `MostRecent`
   * marks the current one.
   */
  static mostRecentSteamId(loginUsers: string): string | null {
    const users = TextVdf.parse(loginUsers).users;
    if (!isBlock(users)) return null;

    const accounts = Object.entries(users).filter(
      (entry): entry is [string, ITextVdf] =>
        isSteamId(entry[0]) && isBlock(entry[1]),
    );
    const recent = accounts.find(
      ([, account]) => (account.MostRecent ?? account.mostrecent) === '1',
    );

    return (recent ?? accounts[0])?.[0] ?? null;
  }

  /**
   * Which stat feeds each achievement's counter of a game, from the client's
   * cache. Empty when the folder or the file is not there.
   */
  static async readStatMap(
    steamDir: string | null,
    appid: number,
    readFile: ReadFile,
  ): Promise<Map<string, string>> {
    if (!steamDir) return new Map();
    try {
      const file = join(
        steamDir,
        'appcache',
        'stats',
        `UserGameStatsSchema_${appid}.bin`,
      );
      return BinaryVdf.achievementStatMap(
        BinaryVdf.parse(await readFile(file)),
      );
    } catch {
      return new Map();
    }
  }
}
