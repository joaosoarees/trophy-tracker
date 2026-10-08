import { describe, expect, it } from 'vitest';

import { mostRecentSteamId, steamDirCandidates } from '@main/steam/steamFiles';
import { STEAM_ID } from '@test/helpers';

const LOGIN_USERS = `"users"
{
	"76561190000000001"
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

describe('mostRecentSteamId', () => {
  it('picks the account marked as most recent', () => {
    expect(mostRecentSteamId(LOGIN_USERS)).toBe(STEAM_ID);
  });

  it('falls back to the first account when none is marked', () => {
    expect(mostRecentSteamId(LOGIN_USERS.replace('"MostRecent"		"1"', ''))).toBe(
      '76561190000000001',
    );
  });

  it('returns nothing for a file with no accounts', () => {
    expect(mostRecentSteamId('"users" { }')).toBeNull();
    expect(mostRecentSteamId('not a vdf at all')).toBeNull();
  });
});

describe('steamDirCandidates', () => {
  it('knows where the client lives on each system', () => {
    expect(steamDirCandidates('darwin', '/Users/me')).toEqual([
      '/Users/me/Library/Application Support/Steam',
    ]);
    const linux = steamDirCandidates('linux', '/home/me');
    expect(linux[0]).toBe('/home/me/.local/share/Steam');
    expect(linux).toContain('/home/me/.steam/steam');
    expect(linux.some((dir) => dir.includes('com.valvesoftware.Steam'))).toBe(
      true,
    );
    expect(steamDirCandidates('freebsd', '/home/me')).toEqual([]);
  });
});
