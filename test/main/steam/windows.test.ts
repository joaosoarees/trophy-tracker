import { describe, expect, it } from 'vitest';

import {
  accountIdToSteamId,
  parseRegValue,
  toLocalPath,
} from '@main/steam/windows';
import { STEAM_ID } from '@test/helpers';

describe('Windows interop', () => {
  it('reads reg.exe values', () => {
    expect(
      parseRegValue(
        '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    RunningAppID    REG_DWORD    0x28442a\r\n\r\n',
      ),
    ).toBe(2638890);
    expect(
      parseRegValue(
        '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n',
      ),
    ).toBe('c:/program files (x86)/steam');
    expect(
      parseRegValue(
        'ERROR: The system was unable to find the specified registry key or value.',
      ),
    ).toBeNull();
  });

  it('converts the signed-in account to a SteamID64', () => {
    expect(accountIdToSteamId(0xeb738e9)).toBe(STEAM_ID);
  });

  it('translates Windows paths to WSL', () => {
    expect(toLocalPath('c:/program files (x86)/steam', true)).toBe(
      '/mnt/c/program files (x86)/steam',
    );
    expect(toLocalPath('D:\\Steam', true)).toBe('/mnt/d/Steam');
    expect(toLocalPath('D:\\Steam', false)).toBe('D:\\Steam');
  });
});
