import { execFile } from 'node:child_process';
import { release } from 'node:os';
import { promisify } from 'node:util';

import { STEAM_ID_BASE } from '@shared/validation';

const STEAM_KEY = 'HKCU\\Software\\Valve\\Steam';

const execFileAsync = promisify(execFile);

/** Runs a Windows executable and answers what it printed. */
type RunCommand = (file: string, args: string[]) => Promise<string>;

const run: RunCommand = async (file, args) => {
  const { stdout } = await execFileAsync(file, args, {
    timeout: 10_000,
    windowsHide: true,
  });
  return stdout;
};

// The kernel alone is not enough: a container on a WSL host has the same kernel
// but no way to reach Windows. WSL itself sets this variable for every process.
const isWsl =
  process.platform === 'linux' &&
  /microsoft/i.test(release()) &&
  process.env.WSL_DISTRO_NAME !== undefined;

/** What reaching Windows needs from the system; tests pass their own. */
export interface IWindowsDeps {
  run: RunCommand;
  hasWindows: boolean;
  isWsl: boolean;
}

const psQuote = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/**
 * The Windows side of the Steam client: its registry, the browser and what
 * the system says about installers. Works natively on Windows and, from WSL,
 * by calling the same .exe files through interop.
 */
export class Windows {
  static readonly isWsl = isWsl;
  /** Whether the Windows registry can be reached (Windows itself, or WSL). */
  static readonly hasWindows = isWsl || process.platform === 'win32';

  constructor(
    private readonly deps: IWindowsDeps = {
      run,
      hasWindows: Windows.hasWindows,
      isWsl: Windows.isWsl,
    },
  ) {}

  /** Extracts the value from the output of `reg query ... /v name`. */
  static parseRegValue(output: string): string | number | null {
    const m = /^\s+\S+\s+(REG_\w+)\s+(.*?)\s*$/m.exec(
      output.replace(/\r/g, ''),
    );
    if (!m) return null;
    return m[1] === 'REG_DWORD' ? Number.parseInt(m[2], 16) : m[2];
  }

  static accountIdToSteamId(accountId: number): string {
    return (STEAM_ID_BASE + BigInt(accountId)).toString();
  }

  /** `c:/program files (x86)/steam` → `/mnt/c/program files (x86)/steam` on WSL. */
  static toLocalPath(windowsPath: string, isWsl = Windows.isWsl): string {
    if (!isWsl) return windowsPath;
    const m = /^([a-zA-Z]):[\\/](.*)$/.exec(windowsPath);
    return m
      ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`
      : windowsPath;
  }

  /** AppID of the running game, or `null` when no game is open. */
  async getRunningAppId(): Promise<number | null> {
    const v = await this.regValue(STEAM_KEY, 'RunningAppID');
    return typeof v === 'number' && v > 0 ? v : null;
  }

  /**
   * SteamID64 of the account signed in to the Steam client; `null` when the
   * registry says nobody is. Rejects when the registry could not be asked.
   */
  async getActiveSteamId(): Promise<string | null> {
    const v = await this.queryReg(`${STEAM_KEY}\\ActiveProcess`, 'ActiveUser');
    return typeof v === 'number' && v > 0
      ? Windows.accountIdToSteamId(v)
      : null;
  }

  /** Folder of the Steam client, as a path this process can read. */
  async getSteamPath(): Promise<string | null> {
    const steamPath = await this.regValue(STEAM_KEY, 'SteamPath');
    return typeof steamPath === 'string'
      ? Windows.toLocalPath(steamPath, this.deps.isWsl)
      : null;
  }

  /**
   * Whether Smart App Control is enforcing (not just evaluating). When it is,
   * Windows refuses to run executables that are neither signed nor known to
   * Microsoft's reputation service, and offers no per-app exception.
   */
  async isSmartAppControlOn(): Promise<boolean> {
    const state = await this.regValue(
      'HKLM\\SYSTEM\\CurrentControlSet\\Control\\CI\\Policy',
      'VerifiedAndReputablePolicyState',
    );
    return state === 1;
  }

  /** Whether a Windows executable carries a valid code signature. */
  async isSigned(file: string): Promise<boolean> {
    try {
      const status = await this.deps.run('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-AuthenticodeSignature -LiteralPath ${psQuote(file)}).Status`,
      ]);
      return status.trim() === 'Valid';
    } catch {
      return false;
    }
  }

  async openInBrowser(url: string): Promise<void> {
    await this.deps.run('rundll32.exe', ['url.dll,FileProtocolHandler', url]);
  }

  /** A registry value, or `null` when it is not there or could not be asked for. */
  private regValue(key: string, name: string): Promise<string | number | null> {
    return this.queryReg(key, name).catch(() => null);
  }

  /**
   * A registry value, or `null` when the registry has none by that name:
   * `reg.exe` ran and ended with code 1. Anything else that goes wrong (the
   * command cannot be started, is killed for taking too long) rejects.
   */
  private async queryReg(
    key: string,
    name: string,
  ): Promise<string | number | null> {
    if (!this.deps.hasWindows) return null;
    try {
      return Windows.parseRegValue(
        await this.deps.run('reg.exe', ['query', key, '/v', name]),
      );
    } catch (e) {
      if ((e as { code?: unknown }).code === 1) return null;
      throw e;
    }
  }
}
