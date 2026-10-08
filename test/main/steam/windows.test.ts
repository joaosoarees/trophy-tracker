import { describe, expect, it } from 'vitest';

import {
  accountIdToSteamId,
  parseRegValue,
  toLocalPath,
} from '@main/steam/windows';
import { STEAM_ID } from '@test/helpers';

describe('Windows interop', () => {
  it.each([
    {
      kind: 'a number',
      output:
        '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    RunningAppID    REG_DWORD    0x28442a\r\n\r\n',
      value: 2638890,
    },
    {
      kind: 'a text',
      output:
        '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n',
      value: 'c:/program files (x86)/steam',
    },
    {
      kind: 'nothing when the value does not exist',
      output:
        'ERROR: The system was unable to find the specified registry key or value.',
      value: null,
    },
  ])('reads $kind from the output of reg.exe', ({ output, value }) => {
    expect(parseRegValue(output)).toBe(value);
  });

  it('converts the signed-in account to a SteamID64', () => {
    expect(accountIdToSteamId(0xeb738e9)).toBe(STEAM_ID);
  });

  it.each([
    {
      from: 'c:/program files (x86)/steam',
      to: '/mnt/c/program files (x86)/steam',
    },
    { from: 'D:\\Steam', to: '/mnt/d/Steam' },
  ])('translates the Windows path $from to WSL', ({ from, to }) => {
    expect(toLocalPath(from, true)).toBe(to);
  });

  it('leaves the path alone on Windows itself', () => {
    expect(toLocalPath('D:\\Steam', false)).toBe('D:\\Steam');
  });
});
