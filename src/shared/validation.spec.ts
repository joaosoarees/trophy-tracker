import { describe, expect, it } from 'vitest';

import { API_KEY_PATTERN, isSteamId } from './validation';

describe('validation', () => {
  describe('API_KEY_PATTERN', () => {
    it.each([
      { kind: 'in capitals', value: '0123456789ABCDEF0123456789ABCDEF' },
      { kind: 'in small letters', value: '0123456789abcdef0123456789abcdef' },
      { kind: 'in both', value: '0123456789abcdefFEDCBA9876543210' },
    ])('should match 32 hexadecimal digits $kind: $value', ({ value }) => {
      const isValid = API_KEY_PATTERN.test(value);

      expect(isValid).toBe(true);
    });

    it.each([
      { kind: '31 digits', value: '0123456789ABCDEF0123456789ABCDE' },
      { kind: '33 digits', value: '0123456789ABCDEF0123456789ABCDEF0' },
      {
        kind: 'a letter past F',
        value: '0123456789ABCDEF0123456789ABCDEG',
      },
      {
        kind: 'a key after other text',
        value: 'key=0123456789ABCDEF0123456789ABCDEF',
      },
      {
        kind: 'a key before other text',
        value: '0123456789ABCDEF0123456789ABCDEF ',
      },
      { kind: 'nothing', value: '' },
    ])('should not match $kind: "$value"', ({ value }) => {
      const isValid = API_KEY_PATTERN.test(value);

      expect(isValid).toBe(false);
    });
  });

  describe('isSteamId', () => {
    it.each([
      { kind: 'an account created early', value: '76561197960265729' },
      { kind: 'an account of today', value: '76561198000000042' },
      {
        kind: 'an account past the 7656119 prefix',
        value: '76561200000000000',
      },
      {
        kind: 'the last account number there can be',
        value: '76561202255233023',
      },
    ])('should answer true when given $kind: $value', ({ value }) => {
      const isValid = isSteamId(value);

      expect(isValid).toBe(true);
    });

    it.each([
      { kind: 'fewer than 17 digits', value: '7656119800000004' },
      { kind: 'more than 17 digits', value: '765611980000000420' },
      { kind: 'something that is not a number', value: '7656119800000004x' },
      { kind: 'a number below the first account', value: '76561197960265728' },
      { kind: 'a number above the last account', value: '76561202255233024' },
      { kind: 'a 17-digit number of another kind', value: '10000000000000000' },
      {
        kind: 'an account number after other text',
        value: 'id 76561198000000042',
      },
      {
        kind: 'an account number before other text',
        value: '76561198000000042 ',
      },
      { kind: 'nothing', value: '' },
    ])('should answer false when given $kind: "$value"', ({ value }) => {
      const isValid = isSteamId(value);

      expect(isValid).toBe(false);
    });
  });
});
