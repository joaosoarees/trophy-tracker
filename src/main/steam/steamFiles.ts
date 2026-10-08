import { posix } from 'node:path';

import { type ITextVdf, parseTextVdf } from './textVdf';

/** Where the Steam client may be installed, most likely first. */
export function steamDirCandidates(
  platform: NodeJS.Platform,
  home: string,
): string[] {
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

const isBlock = (value: string | ITextVdf | undefined): value is ITextVdf =>
  typeof value === 'object';

/**
 * SteamID64 of the account last signed in, from `config/loginusers.vdf`.
 * The file lists every account that signed in on this computer; `MostRecent`
 * marks the current one.
 */
export function mostRecentSteamId(loginUsers: string): string | null {
  const users = parseTextVdf(loginUsers).users;
  if (!isBlock(users)) return null;

  const accounts = Object.entries(users).filter(
    (entry): entry is [string, ITextVdf] =>
      /^7656119\d{10}$/.test(entry[0]) && isBlock(entry[1]),
  );
  const recent = accounts.find(
    ([, account]) => (account.MostRecent ?? account.mostrecent) === '1',
  );

  return (recent ?? accounts[0])?.[0] ?? null;
}
