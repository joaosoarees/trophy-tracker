import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import { join } from 'node:path'
import type { Api, AppState, CheckResult, GameView, GuideSite } from '../shared/types'
import { checkApiKey, checkPrivacy, checkSteamId } from './onboarding'
import { guideUrl, newlyUnlocked } from './steam/achievements'
import { SteamClient, SteamError } from './steam/client'
import {
  getActiveSteamId,
  getRunningAppId,
  isWsl,
  openInWindowsBrowser,
  readStatMap,
  windowsToast
} from './steam/windows'
import { Store, type Cipher } from './store'
import { Tracker } from './tracker'

const RUNNING_CHECK_MS = 10_000
const UNLOCK_CHECK_MS = 60_000

const EXTERNAL = {
  apikey: 'https://steamcommunity.com/dev/apikey',
  privacy: 'https://steamcommunity.com/my/edit/settings',
  account: 'https://store.steampowered.com/account/'
}

let win: BrowserWindow | null = null
let store: Store
let tracker: Tracker
const client = new SteamClient()

/** Preenchido quando a Steam passa a recusar a chave salva; força o onboarding de novo. */
let configError: string | null = null
let current: { appid: number; running: boolean } | null = null
let lastView: GameView | null = null

const openUrl = (url: string): Promise<void> => (isWsl ? openInWindowsBrowser(url) : shell.openExternal(url))

function state(): AppState {
  const configured = store.getCredentials() !== null && configError === null
  return { configured, profile: store.getProfile(), configError }
}

async function attempt<T>(fn: () => Promise<T>): Promise<CheckResult<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (e) {
    if (e instanceof SteamError) {
      if (e.kind === 'invalid-key') configError = e.message
      return { ok: false, error: e.message }
    }
    console.error(e)
    return { ok: false, error: 'Erro inesperado. Tente de novo.' }
  }
}

async function resolveCurrent(): Promise<typeof current> {
  const running = await getRunningAppId()
  if (running !== null) return { appid: running, running: true }
  if (!state().configured) return null
  const last = await tracker.lastPlayedAppId().catch(() => null)
  return last === null ? null : { appid: last, running: false }
}

async function checkRunningGame(): Promise<void> {
  const next = await resolveCurrent()
  if (next?.appid === current?.appid && next?.running === current?.running) return
  current = next
  lastView = null
  win?.webContents.send('game-changed', current)
}

async function checkUnlocks(): Promise<void> {
  if (!current?.running || !state().configured) return
  const { appid } = current
  const result = await attempt(() => tracker.getGame(appid, true))
  if (!result.ok || current?.appid !== appid) return
  const view = result.value
  if (lastView?.appid === appid) {
    for (const a of newlyUnlocked(lastView, view)) {
      const left = view.total - view.unlockedCount
      const body = `${a.name} · ${left === 0 ? 'todas as conquistas obtidas!' : `faltam ${left}`}`
      windowsToast(`Conquista desbloqueada — ${view.name}`, body).catch(() => {})
    }
  }
  lastView = view
  win?.webContents.send('game-updated', view)
}

function registerIpc(): void {
  const handlers: Omit<Api, 'onGameChanged' | 'onGameUpdated' | 'onDashboardProgress'> = {
    getState: async () => state(),
    detectSteamId: () => getActiveSteamId(),
    checkSteamId: async (steamId) => {
      const result = await checkSteamId(steamId)
      if (result.status === 'unconfirmed') console.warn(`SteamID ${result.steamId} não confirmado: ${result.reason}`)
      return result
    },
    checkApiKey: (steamId, apiKey) => checkApiKey(client, steamId, apiKey),
    checkPrivacy: (steamId, apiKey) => checkPrivacy(client, steamId, apiKey),
    saveConfig: async (steamId, apiKey) => {
      const check = await checkApiKey(client, steamId, apiKey)
      if (check.ok) {
        store.setCredentials({ steamId, apiKey: apiKey.trim() }, check.value)
        configError = null
        void checkRunningGame()
      }
      return state()
    },
    resetConfig: async () => {
      store.clearCredentials()
      configError = null
      current = null
      lastView = null
      return state()
    },
    getCurrentAppId: async () => (current = await resolveCurrent()),
    getGame: (appid, force) =>
      attempt(async () => {
        const view = await tracker.getGame(appid, force)
        if (current?.appid === appid) lastView = view
        return view
      }),
    getDashboard: (force) =>
      attempt(() => tracker.getDashboard(force, (done, total) => win?.webContents.send('dashboard-progress', done, total))),
    getUserData: async (appid) => store.getUserData(appid),
    setUserData: async (appid, achievementId, data) => store.setUserData(appid, achievementId, data),
    openGuide: (site: GuideSite, appid, game, achievement) => openUrl(guideUrl(site, appid, game, achievement)),
    openExternal: (target) => openUrl(EXTERNAL[target])
  }
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle(name, (_event, ...args) => (fn as (...a: unknown[]) => unknown)(...args))
  }
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 520,
    height: 860,
    minWidth: 420,
    minHeight: 520,
    backgroundColor: '#171a21',
    autoHideMenuBar: true,
    title: 'Conquistas da Steam',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true }
  })
  win.on('closed', () => (win = null))
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openUrl(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  // Sem keyring (comum no WSL) o safeStorage cairia num esquema fraco; aí vale o arquivo com permissão 600.
  const secure =
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')
  const cipher: Cipher | null = secure
    ? {
        encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
        decrypt: (encoded) => safeStorage.decryptString(Buffer.from(encoded, 'base64'))
      }
    : null

  store = new Store(app.getPath('userData'), cipher)
  tracker = new Tracker({ store, client, readStatMap })

  registerIpc()
  createWindow()
  setInterval(() => void checkRunningGame(), RUNNING_CHECK_MS)
  setInterval(() => void checkUnlocks(), UNLOCK_CHECK_MS)
})

app.on('window-all-closed', () => app.quit())
