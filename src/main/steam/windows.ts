import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { release } from 'node:os'
import { join } from 'node:path'
import { achievementStatMap, parseBinaryVdf } from './vdf'

// The Steam client runs on Windows; from WSL we reach it through the .exe files via interop.

export const isWsl = process.platform === 'linux' && /microsoft/i.test(release())
export const hasWindows = isWsl || process.platform === 'win32'

const STEAM_KEY = 'HKCU\\Software\\Valve\\Steam'
const STEAM_ID64_BASE = 76561197960265728n

function run(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 10_000, windowsHide: true }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    )
  })
}

/** Extracts the value from the output of `reg query ... /v name`. */
export function parseRegValue(output: string): string | number | null {
  const m = /^\s+\S+\s+(REG_\w+)\s+(.*?)\s*$/m.exec(output.replace(/\r/g, ''))
  if (!m) return null
  return m[1] === 'REG_DWORD' ? Number.parseInt(m[2], 16) : m[2]
}

async function regValue(key: string, name: string): Promise<string | number | null> {
  if (!hasWindows) return null
  try {
    return parseRegValue(await run('reg.exe', ['query', key, '/v', name]))
  } catch {
    return null
  }
}

/** AppID of the running game, or `null` when no game is open. */
export async function getRunningAppId(): Promise<number | null> {
  const v = await regValue(STEAM_KEY, 'RunningAppID')
  return typeof v === 'number' && v > 0 ? v : null
}

export const accountIdToSteamId = (accountId: number): string => (STEAM_ID64_BASE + BigInt(accountId)).toString()

/** SteamID64 of the account signed in to the Steam client. */
export async function getActiveSteamId(): Promise<string | null> {
  const v = await regValue(`${STEAM_KEY}\\ActiveProcess`, 'ActiveUser')
  return typeof v === 'number' && v > 0 ? accountIdToSteamId(v) : null
}

/** `c:/program files (x86)/steam` → `/mnt/c/program files (x86)/steam` on WSL. */
export function toLocalPath(windowsPath: string, wsl = isWsl): string {
  if (!wsl) return windowsPath
  const m = /^([a-zA-Z]):[\\/](.*)$/.exec(windowsPath)
  return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : windowsPath
}

/** Reads from the Steam client cache which stat feeds each achievement's counter. */
export async function readStatMap(appid: number): Promise<Map<string, string>> {
  const steamPath = await regValue(STEAM_KEY, 'SteamPath')
  if (typeof steamPath !== 'string') return new Map()
  try {
    const file = join(toLocalPath(steamPath), 'appcache', 'stats', `UserGameStatsSchema_${appid}.bin`)
    return achievementStatMap(parseBinaryVdf(await readFile(file)))
  } catch {
    return new Map()
  }
}

export async function openInWindowsBrowser(url: string): Promise<void> {
  await run('rundll32.exe', ['url.dll,FileProtocolHandler', url])
}

const psQuote = (s: string): string => `'${s.replace(/'/g, "''")}'`

/** Windows toast; Electron notifications inside WSLg never reach the notification area. */
export async function windowsToast(title: string, body: string): Promise<void> {
  const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$text = $xml.GetElementsByTagName('text')
$text.Item(0).AppendChild($xml.CreateTextNode(${psQuote(title)})) | Out-Null
$text.Item(1).AppendChild($xml.CreateTextNode(${psQuote(body)})) | Out-Null
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
`
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded])
}
