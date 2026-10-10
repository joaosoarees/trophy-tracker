import { describe, expect, it } from 'vitest';

import { STEAM_ID } from '@tests/helpers';

import { Windows } from './Windows';

const STEAM_KEY = 'HKCU\\Software\\Valve\\Steam';
const POLICY_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\CI\\Policy';

interface IRegistryValue {
  key: string;
  name: string;
  type: string;
  data: string;
}

interface ISetupOverrides {
  /** The one value in the registry; a query for any other fails. */
  registry?: IRegistryValue;
  /** What a command other than `reg.exe` prints. */
  output?: string;
  /** Makes every command fail with this error. */
  failure?: Error;
  hasWindows?: boolean;
  isWsl?: boolean;
}

/** What `reg query` prints for one value. */
const regOutput = ({ key, name, type, data }: IRegistryValue) =>
  `\r\n${key}\r\n    ${name}    ${type}    ${data}\r\n\r\n`;

/** A Windows, reached natively, that keeps every command it was asked to run. */
function setup({
  registry,
  output = '',
  failure,
  ...deps
}: ISetupOverrides = {}) {
  const commands: [string, string[]][] = [];
  const sut = new Windows({
    hasWindows: true,
    isWsl: false,
    run: (file, args) => {
      commands.push([file, args]);
      if (failure) return Promise.reject(failure);
      if (file !== 'reg.exe') return Promise.resolve(output);
      const [, key, , name] = args;
      return registry?.key === key && registry.name === name
        ? Promise.resolve(regOutput(registry))
        : Promise.reject(new Error(`reg.exe: no ${key} ${name}`));
    },
    ...deps,
  });
  return { sut, commands };
}

describe('Windows', () => {
  describe('parseRegValue', () => {
    it.each([
      {
        printed: 'a REG_DWORD',
        output:
          '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    RunningAppID    REG_DWORD    0x28442a\r\n\r\n',
        expected: 2638890,
      },
      {
        printed: 'a REG_SZ',
        output:
          '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n',
        expected: 'c:/program files (x86)/steam',
      },
      {
        printed: 'that the value does not exist',
        output:
          'ERROR: The system was unable to find the specified registry key or value.',
        expected: null,
      },
    ])(
      'should answer $expected when reg.exe prints $printed',
      ({ output, expected }) => {
        const value = Windows.parseRegValue(output);

        expect(value).toBe(expected);
      },
    );
  });

  describe('accountIdToSteamId', () => {
    it('should answer the SteamID64 when given the account number of the registry', () => {
      const steamId = Windows.accountIdToSteamId(0x25e4c2a);

      expect(steamId).toBe(STEAM_ID);
    });
  });

  describe('toLocalPath', () => {
    it.each([
      {
        from: 'c:/program files (x86)/steam',
        to: '/mnt/c/program files (x86)/steam',
      },
      { from: 'D:\\Steam', to: '/mnt/d/Steam' },
    ])('should translate $from to $to when on WSL', ({ from, to }) => {
      const path = Windows.toLocalPath(from, true);

      expect(path).toBe(to);
    });

    it('should leave the path alone when on Windows itself', () => {
      const path = Windows.toLocalPath('D:\\Steam', false);

      expect(path).toBe('D:\\Steam');
    });
  });

  describe('getRunningAppId', () => {
    it('should answer the game when the registry has one running', async () => {
      const { sut } = setup({
        registry: {
          key: STEAM_KEY,
          name: 'RunningAppID',
          type: 'REG_DWORD',
          data: '0x28442a',
        },
      });

      const appId = await sut.getRunningAppId();

      expect(appId).toBe(2638890);
    });

    it('should ask reg.exe once for the value when asked for the running game', async () => {
      const { sut, commands } = setup();

      await sut.getRunningAppId();

      expect(commands).toEqual([
        [
          'reg.exe',
          ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID'],
        ],
      ]);
    });

    it('should answer null when the registry says zero', async () => {
      const { sut } = setup({
        registry: {
          key: STEAM_KEY,
          name: 'RunningAppID',
          type: 'REG_DWORD',
          data: '0x0',
        },
      });

      const appId = await sut.getRunningAppId();

      expect(appId).toBeNull();
    });

    it('should answer null when the query fails', async () => {
      const { sut } = setup({ failure: new Error('reg.exe not found') });

      const appId = await sut.getRunningAppId();

      expect(appId).toBeNull();
    });

    it('should answer null without running anything when there is no Windows', async () => {
      const { sut, commands } = setup({
        registry: {
          key: STEAM_KEY,
          name: 'RunningAppID',
          type: 'REG_DWORD',
          data: '0x28442a',
        },
        hasWindows: false,
      });

      const appId = await sut.getRunningAppId();

      expect(appId).toBeNull();
      expect(commands).toEqual([]);
    });
  });

  describe('getActiveSteamId', () => {
    it('should answer the SteamID64 of the account when the registry has one signed in', async () => {
      const { sut } = setup({
        registry: {
          key: `${STEAM_KEY}\\ActiveProcess`,
          name: 'ActiveUser',
          type: 'REG_DWORD',
          data: '0x25e4c2a',
        },
      });

      const steamId = await sut.getActiveSteamId();

      expect(steamId).toBe(STEAM_ID);
    });

    it('should answer null when the registry says zero', async () => {
      const { sut } = setup({
        registry: {
          key: `${STEAM_KEY}\\ActiveProcess`,
          name: 'ActiveUser',
          type: 'REG_DWORD',
          data: '0x0',
        },
      });

      const steamId = await sut.getActiveSteamId();

      expect(steamId).toBeNull();
    });
  });

  describe('getSteamPath', () => {
    it('should answer the folder as the registry has it when on Windows itself', async () => {
      const { sut } = setup({
        registry: {
          key: STEAM_KEY,
          name: 'SteamPath',
          type: 'REG_SZ',
          data: 'c:/steam',
        },
      });

      const steamPath = await sut.getSteamPath();

      expect(steamPath).toBe('c:/steam');
    });

    it('should answer the folder as a WSL path when on WSL', async () => {
      const { sut } = setup({
        registry: {
          key: STEAM_KEY,
          name: 'SteamPath',
          type: 'REG_SZ',
          data: 'c:/steam',
        },
        isWsl: true,
      });

      const steamPath = await sut.getSteamPath();

      expect(steamPath).toBe('/mnt/c/steam');
    });

    it('should answer null when the query fails', async () => {
      const { sut } = setup({ failure: new Error('reg.exe not found') });

      const steamPath = await sut.getSteamPath();

      expect(steamPath).toBeNull();
    });
  });

  describe('isSmartAppControlOn', () => {
    it.each([
      { state: 'enforcing', data: '0x1', shouldBeOn: true },
      { state: 'evaluating', data: '0x2', shouldBeOn: false },
      { state: 'off', data: '0x0', shouldBeOn: false },
    ])(
      'should answer $shouldBeOn when Smart App Control is $state',
      async ({ data, shouldBeOn }) => {
        const { sut } = setup({
          registry: {
            key: POLICY_KEY,
            name: 'VerifiedAndReputablePolicyState',
            type: 'REG_DWORD',
            data,
          },
        });

        const isOn = await sut.isSmartAppControlOn();

        expect(isOn).toBe(shouldBeOn);
      },
    );

    it('should answer false when this Windows does not have it', async () => {
      const { sut } = setup({ failure: new Error('value not found') });

      const isOn = await sut.isSmartAppControlOn();

      expect(isOn).toBe(false);
    });
  });

  describe('isSigned', () => {
    it.each([
      { status: 'Valid', shouldBeSigned: true },
      { status: 'NotSigned', shouldBeSigned: false },
      { status: 'HashMismatch', shouldBeSigned: false },
    ])(
      'should answer $shouldBeSigned when the signature is reported as $status',
      async ({ status, shouldBeSigned }) => {
        const { sut } = setup({ output: `${status}\r\n` });

        const isSigned = await sut.isSigned('C:\\app.exe');

        expect(isSigned).toBe(shouldBeSigned);
      },
    );

    it('should answer false when the file cannot be checked', async () => {
      const { sut } = setup({ failure: new Error('powershell.exe not found') });

      const isSigned = await sut.isSigned('C:\\app.exe');

      expect(isSigned).toBe(false);
    });

    it('should double the apostrophe in the command when the path has one', async () => {
      const { sut, commands } = setup({ output: 'Valid' });

      await sut.isSigned("C:\\Users\\O'Brien\\app.exe");

      expect(commands).toEqual([
        [
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            "(Get-AuthenticodeSignature -LiteralPath 'C:\\Users\\O''Brien\\app.exe').Status",
          ],
        ],
      ]);
    });
  });

  describe('openInBrowser', () => {
    it('should hand the link to the Windows browser when asked to open it', async () => {
      const { sut, commands } = setup();

      await sut.openInBrowser('https://example.com/?a=1&b=2');

      expect(commands).toEqual([
        [
          'rundll32.exe',
          ['url.dll,FileProtocolHandler', 'https://example.com/?a=1&b=2'],
        ],
      ]);
    });
  });
});
