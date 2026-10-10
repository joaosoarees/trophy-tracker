import { describe, expect, it } from 'vitest';

import { TextVdf } from '@main/steam/TextVdf';
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

describe('TextVdf.parse', () => {
  it('reads nested blocks, pairs and escaped quotes', () => {
    const parsed = TextVdf.parse(LOGIN_USERS) as Record<string, any>;
    expect(Object.keys(parsed.users)).toEqual(['76561198000000001', STEAM_ID]);
    expect(parsed.users['76561198000000001'].AccountName).toBe(
      'old "quoted" account',
    );
    expect(parsed.users[STEAM_ID].Timestamp).toBe('1790000000');
  });

  it('survives an empty or truncated file', () => {
    expect(TextVdf.parse('')).toEqual({});
    expect(TextVdf.parse('"users" { "765" { "MostRecent" "1"')).toEqual({
      users: { '765': { MostRecent: '1' } },
    });
  });
});
