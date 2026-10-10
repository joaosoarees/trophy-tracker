import { describe, expect, it } from 'vitest';

import { STEAM_ID } from '@tests/helpers';

import { TextVdf } from './TextVdf';

const LOGIN_USERS = `"users"
{
	"76561198000000001"
	{
		"AccountName"		"old"
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

describe('TextVdf', () => {
  describe('parse', () => {
    it('should read the pairs and the nested blocks of a file', () => {
      const parsed = TextVdf.parse(LOGIN_USERS);

      expect(parsed).toEqual({
        users: {
          '76561198000000001': {
            AccountName: 'old',
            PersonaName: 'Old',
            MostRecent: '0',
          },
          [STEAM_ID]: {
            AccountName: 'current',
            MostRecent: '1',
            Timestamp: '1790000000',
          },
        },
      });
    });

    it('should keep the blocks in the order of the file', () => {
      const parsed = TextVdf.parse(LOGIN_USERS);

      expect(Object.keys(parsed.users)).toEqual([
        '76561198000000001',
        STEAM_ID,
      ]);
    });

    it('should read an escaped quote as part of the value', () => {
      const parsed = TextVdf.parse('"AccountName" "old \\"quoted\\" account"');

      expect(parsed).toEqual({ AccountName: 'old "quoted" account' });
    });

    it('should answer an empty object when the file is empty', () => {
      const parsed = TextVdf.parse('');

      expect(parsed).toEqual({});
    });

    it('should leave out a key with no value when its block closes right after it', () => {
      const parsed = TextVdf.parse('"users" { "765" } "MostRecent" "1"');

      expect(parsed).toEqual({ users: {}, MostRecent: '1' });
    });

    it('should leave out a key with no value when the file ends right after it', () => {
      const parsed = TextVdf.parse('"MostRecent" "1" "Timestamp"');

      expect(parsed).toEqual({ MostRecent: '1' });
    });

    it('should read the pairs when a brace that follows no key opens the file', () => {
      const parsed = TextVdf.parse('{ "MostRecent" "1" }');

      expect(parsed).toEqual({ MostRecent: '1' });
    });

    it('should keep what it read when the file ends before its blocks close', () => {
      const parsed = TextVdf.parse('"users" { "765" { "MostRecent" "1"');

      expect(parsed).toEqual({ users: { '765': { MostRecent: '1' } } });
    });
  });
});
