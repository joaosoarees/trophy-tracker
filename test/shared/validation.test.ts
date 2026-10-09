import { describe, expect, it } from 'vitest';

import { isSteamId } from '@shared/validation';

describe('isSteamId', () => {
  it.each([
    ['an account created early', '76561197960265729'],
    ['an account of today', '76561198000000042'],
    ['an account past the 7656119 prefix', '76561200000000000'],
    ['the last account number there can be', '76561202255233023'],
  ])('accepts %s', (_case, value) => {
    expect(isSteamId(value)).toBe(true);
  });

  it.each([
    ['fewer than 17 digits', '7656119800000004'],
    ['more than 17 digits', '765611980000000420'],
    ['something that is not a number', '7656119800000004x'],
    ['a number below the first account', '76561197960265728'],
    ['a number above the last account', '76561202255233024'],
    ['a 17-digit number of another kind', '10000000000000000'],
    ['nothing', ''],
  ])('refuses %s', (_case, value) => {
    expect(isSteamId(value)).toBe(false);
  });
});
