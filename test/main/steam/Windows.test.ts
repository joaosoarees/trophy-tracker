import { describe, expect, it } from 'vitest';

import { type IWindowsDeps, Windows } from '@main/steam/Windows';
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
    expect(Windows.parseRegValue(output)).toBe(value);
  });

  it('converts the signed-in account to a SteamID64', () => {
    expect(Windows.accountIdToSteamId(0x25e4c2a)).toBe(STEAM_ID);
  });

  it.each([
    {
      from: 'c:/program files (x86)/steam',
      to: '/mnt/c/program files (x86)/steam',
    },
    { from: 'D:\\Steam', to: '/mnt/d/Steam' },
  ])('translates the Windows path $from to WSL', ({ from, to }) => {
    expect(Windows.toLocalPath(from, true)).toBe(to);
  });

  it('leaves the path alone on Windows itself', () => {
    expect(Windows.toLocalPath('D:\\Steam', false)).toBe('D:\\Steam');
  });
});

/** What `reg query` prints for one value. */
const regOutput = (name: string, type: string, value: string) =>
  `\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    ${name}    ${type}    ${value}\r\n\r\n`;

/** A Windows where each command prints what the test says, or fails. */
function windows(
  answer: string | Error = '',
  over: Partial<IWindowsDeps> = {},
): IWindowsDeps & { commands: [string, string[]][] } {
  const commands: [string, string[]][] = [];
  return {
    commands,
    hasWindows: true,
    isWsl: false,
    run: (file, args) => {
      commands.push([file, args]);
      return answer instanceof Error
        ? Promise.reject(answer)
        : Promise.resolve(answer);
    },
    ...over,
  };
}

describe('the Steam registry', () => {
  it('reads the running game', async () => {
    const system = windows(regOutput('RunningAppID', 'REG_DWORD', '0x28442a'));

    expect(await new Windows(system).getRunningAppId()).toBe(2638890);
    expect(system.commands).toEqual([
      [
        'reg.exe',
        ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID'],
      ],
    ]);
  });

  it('knows no game is running when the registry says zero', async () => {
    const system = windows(regOutput('RunningAppID', 'REG_DWORD', '0x0'));

    expect(await new Windows(system).getRunningAppId()).toBeNull();
  });

  it('reads the signed-in account as a SteamID64', async () => {
    const system = windows(regOutput('ActiveUser', 'REG_DWORD', '0x25e4c2a'));

    expect(await new Windows(system).getActiveSteamId()).toBe(STEAM_ID);
  });

  it('knows nobody is signed in when the registry says zero', async () => {
    const system = windows(regOutput('ActiveUser', 'REG_DWORD', '0x0'));

    expect(await new Windows(system).getActiveSteamId()).toBeNull();
  });

  it('reads the Steam folder as it is on Windows', async () => {
    const system = windows(regOutput('SteamPath', 'REG_SZ', 'c:/steam'));

    expect(await new Windows(system).getSteamPath()).toBe('c:/steam');
  });

  it('reads the Steam folder as a WSL path from WSL', async () => {
    const system = windows(regOutput('SteamPath', 'REG_SZ', 'c:/steam'), {
      isWsl: true,
    });

    expect(await new Windows(system).getSteamPath()).toBe('/mnt/c/steam');
  });

  it('answers nothing when the query fails', async () => {
    const system = windows(new Error('reg.exe not found'));

    expect(await new Windows(system).getRunningAppId()).toBeNull();
    expect(await new Windows(system).getSteamPath()).toBeNull();
  });

  it('does not even try where there is no Windows', async () => {
    const system = windows('', { hasWindows: false });

    expect(await new Windows(system).getRunningAppId()).toBeNull();
    expect(system.commands).toEqual([]);
  });
});

describe('Smart App Control', () => {
  it.each([
    { state: 'enforcing', value: '0x1', isOn: true },
    { state: 'evaluating', value: '0x2', isOn: false },
    { state: 'off', value: '0x0', isOn: false },
  ])('counts as on only when enforcing: $state', async ({ value, isOn }) => {
    const system = windows(
      regOutput('VerifiedAndReputablePolicyState', 'REG_DWORD', value),
    );

    expect(await new Windows(system).isSmartAppControlOn()).toBe(isOn);
  });

  it('counts as off on a Windows that does not have it', async () => {
    const system = windows(new Error('value not found'));

    expect(await new Windows(system).isSmartAppControlOn()).toBe(false);
  });
});

describe('code signature', () => {
  it.each([
    { status: 'Valid\r\n', isSigned: true },
    { status: 'NotSigned\r\n', isSigned: false },
    { status: 'HashMismatch\r\n', isSigned: false },
  ])(
    'a file reported as $status is signed: $isSigned',
    async ({ status, isSigned }) => {
      expect(await new Windows(windows(status)).isSigned('C:\\app.exe')).toBe(
        isSigned,
      );
    },
  );

  it('treats a file it cannot check as unsigned', async () => {
    const system = windows(new Error('powershell.exe not found'));

    expect(await new Windows(system).isSigned('C:\\app.exe')).toBe(false);
  });

  it('quotes the path so an apostrophe in it cannot end the command', async () => {
    const system = windows('Valid');

    await new Windows(system).isSigned("C:\\Users\\O'Brien\\app.exe");

    expect(system.commands[0][1].at(-1)).toBe(
      "(Get-AuthenticodeSignature -LiteralPath 'C:\\Users\\O''Brien\\app.exe').Status",
    );
  });
});

describe('reaching Windows from WSL', () => {
  it('opens a link in the Windows browser', async () => {
    const system = windows();

    await new Windows(system).openInBrowser('https://example.com/?a=1&b=2');

    expect(system.commands).toEqual([
      [
        'rundll32.exe',
        ['url.dll,FileProtocolHandler', 'https://example.com/?a=1&b=2'],
      ],
    ]);
  });
});
