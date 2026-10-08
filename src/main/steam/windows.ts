import { execFile } from 'node:child_process';
import { release } from 'node:os';
import { promisify } from 'node:util';

// The Windows side of the Steam client: its registry, the browser and the notification area.
// Works natively on Windows and, from WSL, by calling the same .exe files through interop.

// The kernel alone is not enough: a container on a WSL host has the same kernel
// but no way to reach Windows. WSL itself sets this variable for every process.
export const isWsl =
  process.platform === 'linux' &&
  /microsoft/i.test(release()) &&
  process.env.WSL_DISTRO_NAME !== undefined;
export const hasWindows = isWsl || process.platform === 'win32';

const STEAM_KEY = 'HKCU\\Software\\Valve\\Steam';
const STEAM_ID64_BASE = 76561197960265728n;

const execFileAsync = promisify(execFile);

/** Runs a Windows executable and answers what it printed. */
export type RunCommand = (file: string, args: string[]) => Promise<string>;

const run: RunCommand = async (file, args) => {
  const { stdout } = await execFileAsync(file, args, {
    timeout: 10_000,
    windowsHide: true,
  });
  return stdout;
};

/**
 * What the functions below need from the system. Every one of them takes it
 * as its last argument, defaulting to the real thing, so they can be tested
 * without a Windows machine.
 */
export interface IWindowsDeps {
  run: RunCommand;
  hasWindows: boolean;
  isWsl: boolean;
}

const system: IWindowsDeps = { run, hasWindows, isWsl };

/** Extracts the value from the output of `reg query ... /v name`. */
export function parseRegValue(output: string): string | number | null {
  const m = /^\s+\S+\s+(REG_\w+)\s+(.*?)\s*$/m.exec(output.replace(/\r/g, ''));
  if (!m) return null;
  return m[1] === 'REG_DWORD' ? Number.parseInt(m[2], 16) : m[2];
}

async function regValue(
  key: string,
  name: string,
  deps: IWindowsDeps,
): Promise<string | number | null> {
  if (!deps.hasWindows) return null;
  try {
    return parseRegValue(await deps.run('reg.exe', ['query', key, '/v', name]));
  } catch {
    return null;
  }
}

/** AppID of the running game, or `null` when no game is open. */
export async function getRunningAppId(
  deps: IWindowsDeps = system,
): Promise<number | null> {
  const v = await regValue(STEAM_KEY, 'RunningAppID', deps);
  return typeof v === 'number' && v > 0 ? v : null;
}

export const accountIdToSteamId = (accountId: number): string =>
  (STEAM_ID64_BASE + BigInt(accountId)).toString();

/** SteamID64 of the account signed in to the Steam client. */
export async function getActiveSteamId(
  deps: IWindowsDeps = system,
): Promise<string | null> {
  const v = await regValue(`${STEAM_KEY}\\ActiveProcess`, 'ActiveUser', deps);
  return typeof v === 'number' && v > 0 ? accountIdToSteamId(v) : null;
}

/** `c:/program files (x86)/steam` → `/mnt/c/program files (x86)/steam` on WSL. */
export function toLocalPath(windowsPath: string, wsl = isWsl): string {
  if (!wsl) return windowsPath;
  const m = /^([a-zA-Z]):[\\/](.*)$/.exec(windowsPath);
  return m
    ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`
    : windowsPath;
}

/** Folder of the Steam client, as a path this process can read. */
export async function getSteamPath(
  deps: IWindowsDeps = system,
): Promise<string | null> {
  const steamPath = await regValue(STEAM_KEY, 'SteamPath', deps);
  return typeof steamPath === 'string'
    ? toLocalPath(steamPath, deps.isWsl)
    : null;
}

const psQuote = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/**
 * Whether Smart App Control is enforcing (not just evaluating). When it is,
 * Windows refuses to run executables that are neither signed nor known to
 * Microsoft's reputation service, and offers no per-app exception.
 */
export async function isSmartAppControlOn(
  deps: IWindowsDeps = system,
): Promise<boolean> {
  const state = await regValue(
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\CI\\Policy',
    'VerifiedAndReputablePolicyState',
    deps,
  );
  return state === 1;
}

/** Whether a Windows executable carries a valid code signature. */
export async function isSigned(
  file: string,
  deps: IWindowsDeps = system,
): Promise<boolean> {
  try {
    const status = await deps.run('powershell.exe', [
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

export async function openInWindowsBrowser(
  url: string,
  deps: IWindowsDeps = system,
): Promise<void> {
  await deps.run('rundll32.exe', ['url.dll,FileProtocolHandler', url]);
}

/** Windows toast; Electron notifications inside WSLg never reach the notification area. */
export async function windowsToast(
  title: string,
  body: string,
  deps: IWindowsDeps = system,
): Promise<void> {
  const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$text = $xml.GetElementsByTagName('text')
$text.Item(0).AppendChild($xml.CreateTextNode(${psQuote(title)})) | Out-Null
$text.Item(1).AppendChild($xml.CreateTextNode(${psQuote(body)})) | Out-Null
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  await deps.run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-EncodedCommand',
    encoded,
  ]);
}
