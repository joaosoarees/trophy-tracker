import { describe, expect, it } from 'vitest';

import { SteamFiles } from '@main/steam/SteamFiles';
import { STEAM_ID } from '@test/helpers';

const LOGIN_USERS = `"users"
{
	"76561198000000001"
	{
		"AccountName"		"old \\"quoted\\" account"
		"PersonaName"		"Old"
		"MostRecent"		"0"
	}
	"${STEAM_ID}"
	{
		"AccountName"		"current"
		"MostRecent"		"1"
		"Timestamp"		"1790000000"
	}
}
`;

describe('SteamFiles.mostRecentSteamId', () => {
  it('picks the account marked as most recent', () => {
    expect(SteamFiles.mostRecentSteamId(LOGIN_USERS)).toBe(STEAM_ID);
  });

  it('falls back to the first account when none is marked', () => {
    expect(
      SteamFiles.mostRecentSteamId(LOGIN_USERS.replace('"MostRecent"		"1"', '')),
    ).toBe('76561198000000001');
  });

  it('returns nothing for a file with no accounts', () => {
    expect(SteamFiles.mostRecentSteamId('"users" { }')).toBeNull();
    expect(SteamFiles.mostRecentSteamId('not a vdf at all')).toBeNull();
  });
});

describe('SteamFiles.dirCandidates', () => {
  it('knows the single place the client lives in on macOS', () => {
    expect(SteamFiles.dirCandidates('darwin', '/Users/me')).toEqual([
      '/Users/me/Library/Application Support/Steam',
    ]);
  });

  it('tries the usual Linux folder first', () => {
    const [first] = SteamFiles.dirCandidates('linux', '/home/me');

    expect(first).toBe('/home/me/.local/share/Steam');
  });

  it.each(['/home/me/.steam/steam', 'com.valvesoftware.Steam', 'snap/steam'])(
    'also looks on Linux where other packagings install it: %s',
    (fragment) => {
      const candidates = SteamFiles.dirCandidates('linux', '/home/me');

      expect(candidates.some((dir) => dir.includes(fragment))).toBe(true);
    },
  );

  it('has nowhere to look on a system Steam does not run on', () => {
    expect(SteamFiles.dirCandidates('freebsd', '/home/me')).toEqual([]);
  });
});
