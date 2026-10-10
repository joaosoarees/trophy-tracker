import { describe, expect, it } from 'vitest';

import { OTHER_STEAM_ID, STEAM_ID } from '@tests/helpers';

import { SteamFiles } from './SteamFiles';

/** An account of `loginusers.vdf`, marked with `MostRecent` when given. */
const account = (steamId: string, mostRecent?: '0' | '1'): string => {
  const mark = mostRecent === undefined ? '' : `"MostRecent" "${mostRecent}"`;
  return `"${steamId}" { "AccountName" "someone" ${mark} }`;
};

const loginUsers = (...accounts: string[]): string =>
  `"users" { ${accounts.join(' ')} }`;

describe('SteamFiles', () => {
  describe('mostRecentSteamId', () => {
    it('should answer the account marked as most recent', () => {
      const file = loginUsers(
        account(OTHER_STEAM_ID, '0'),
        account(STEAM_ID, '1'),
      );

      const steamId = SteamFiles.mostRecentSteamId(file);

      expect(steamId).toBe(STEAM_ID);
    });

    it('should answer the first account when none is marked', () => {
      const file = loginUsers(account(OTHER_STEAM_ID, '0'), account(STEAM_ID));

      const steamId = SteamFiles.mostRecentSteamId(file);

      expect(steamId).toBe(OTHER_STEAM_ID);
    });

    it.each([
      { reason: 'has no accounts', file: '"users" { }' },
      { reason: 'is not a VDF', file: 'not a vdf at all' },
    ])('should answer null when the file $reason', ({ file }) => {
      const steamId = SteamFiles.mostRecentSteamId(file);

      expect(steamId).toBeNull();
    });
  });

  describe('dirCandidates', () => {
    it('should answer the single folder of the client when the system is macOS', () => {
      const candidates = SteamFiles.dirCandidates('darwin', '/Users/me');

      expect(candidates).toEqual([
        '/Users/me/Library/Application Support/Steam',
      ]);
    });

    it('should answer the usual folder first, then those of other packagings, when the system is Linux', () => {
      const candidates = SteamFiles.dirCandidates('linux', '/home/me');

      expect(candidates).toEqual([
        '/home/me/.local/share/Steam',
        '/home/me/.steam/steam',
        '/home/me/.var/app/com.valvesoftware.Steam/data/Steam',
        '/home/me/snap/steam/common/.local/share/Steam',
      ]);
    });

    it('should answer no folder when Steam does not run on the system', () => {
      const candidates = SteamFiles.dirCandidates('freebsd', '/home/me');

      expect(candidates).toEqual([]);
    });
  });
});
