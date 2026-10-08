import { join } from 'node:path';

import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';

import { messagesFor, type Messages } from '../shared/i18n';
import type {
  IApi,
  IAppState,
  CheckResult,
  IGameView,
  GuideSite,
} from '../shared/types';

import { checkApiKey, checkPrivacy, checkSteamId } from './onboarding';
import { guideUrl, newlyUnlocked } from './steam/achievements';
import { SteamClient, SteamError, steamErrorMessage } from './steam/client';
import {
  getActiveSteamId,
  getRunningAppId,
  isWsl,
  openInWindowsBrowser,
  readStatMap,
  windowsToast,
} from './steam/windows';
import { Store, type ICipher } from './store';
import { Tracker } from './tracker';

const RUNNING_CHECK_MS = 10_000;
const UNLOCK_CHECK_MS = 60_000;

const EXTERNAL = {
  apikey: 'https://steamcommunity.com/dev/apikey',
  privacy: 'https://steamcommunity.com/my/edit/settings',
  account: 'https://store.steampowered.com/account/',
};

let win: BrowserWindow | null = null;
let store: Store;
let tracker: Tracker;
const client = new SteamClient();

/** Set when Steam starts rejecting the saved key; forces the onboarding again. */
let configError: string | null = null;
let current: { appid: number; running: boolean } | null = null;
let lastView: IGameView | null = null;

const openUrl = (url: string): Promise<void> =>
  isWsl ? openInWindowsBrowser(url) : shell.openExternal(url);

const m = (): Messages => messagesFor(store.getLanguage());

function state(): IAppState {
  const configured = store.getCredentials() !== null && configError === null;
  return {
    configured,
    language: store.getLanguage(),
    profile: store.getProfile(),
    configError,
  };
}

async function attempt<T>(fn: () => Promise<T>): Promise<CheckResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    if (e instanceof SteamError) {
      const error = steamErrorMessage(m(), e);
      if (e.kind === 'invalid-key') configError = error;
      return { ok: false, error };
    }
    console.error(e);
    return { ok: false, error: m().errors.unexpected };
  }
}

async function resolveCurrent(): Promise<typeof current> {
  const running = await getRunningAppId();
  if (running !== null) return { appid: running, running: true };
  if (!state().configured) return null;
  const last = await tracker.lastPlayedAppId().catch(() => null);
  return last === null ? null : { appid: last, running: false };
}

async function checkRunningGame(): Promise<void> {
  const next = await resolveCurrent();
  if (next?.appid === current?.appid && next?.running === current?.running)
    return;
  // The game was closed: one last read catches what was unlocked in the final minute.
  if (current?.running && !(next?.running && next.appid === current.appid))
    await checkUnlocks();
  current = next;
  lastView = null;
  win?.webContents.send('game-changed', current);
}

async function checkUnlocks(): Promise<void> {
  if (!current?.running || !state().configured) return;
  const { appid } = current;
  const result = await attempt(() => tracker.getGame(appid, 'poll'));
  if (!result.ok || current?.appid !== appid) return;
  const view = result.value;
  // The tracker returns the same object when nothing changed; then there is nothing to announce.
  if (view === lastView) return;
  if (lastView?.appid === appid) {
    for (const a of newlyUnlocked(lastView, view)) {
      const left = view.total - view.unlockedCount;
      windowsToast(
        m().toast.title(view.name),
        m().toast.body(a.name, left),
      ).catch(() => {});
    }
  }
  lastView = view;
  win?.webContents.send('game-updated', view);
}

type Invokable = Omit<
  IApi,
  'onGameChanged' | 'onGameUpdated' | 'onDashboardProgress'
>;

/** A handler may answer right away; Electron wraps the value in a promise for the interface. */
type IpcHandlers = {
  [K in keyof Invokable]: (
    ...args: Parameters<Invokable[K]>
  ) => ReturnType<Invokable[K]> | Awaited<ReturnType<Invokable[K]>>;
};

function registerIpc(): void {
  const handlers: IpcHandlers = {
    getState: () => state(),
    detectSteamId: () => getActiveSteamId(),
    checkSteamId: async (steamId) => {
      const result = await checkSteamId(m(), steamId);
      if (result.status === 'unconfirmed')
        console.warn(
          `SteamID ${result.steamId} not confirmed: ${result.reason}`,
        );
      return result;
    },
    checkApiKey: (steamId, apiKey) => checkApiKey(m(), client, steamId, apiKey),
    checkPrivacy: (steamId, apiKey) =>
      checkPrivacy(m(), client, steamId, apiKey),
    saveConfig: async (steamId, apiKey) => {
      const check = await checkApiKey(m(), client, steamId, apiKey);
      if (check.ok) {
        store.setCredentials({ steamId, apiKey: apiKey.trim() }, check.value);
        configError = null;
        void checkRunningGame();
      }
      return state();
    },
    resetConfig: () => {
      store.clearCredentials();
      configError = null;
      current = null;
      lastView = null;
      return state();
    },
    getCurrentAppId: async () => (current = await resolveCurrent()),
    getGame: (appid, force) =>
      attempt(async () => {
        const view = await tracker.getGame(appid, force);
        if (current?.appid === appid) lastView = view;
        return view;
      }),
    getDashboard: (mode) =>
      attempt(() =>
        tracker.getDashboard(mode, (done, total) =>
          win?.webContents.send('dashboard-progress', done, total),
        ),
      ),
    getUserData: (appid) => store.getUserData(appid),
    setUserData: (appid, achievementId, data) =>
      store.setUserData(appid, achievementId, data),
    setLanguage: (language) => {
      store.setLanguage(language);
      client.language = language;
      lastView = null;
      win?.setTitle(m().appTitle);
      return state();
    },
    getAlwaysOnTop: () => store.getAlwaysOnTop(),
    setAlwaysOnTop: (value) => {
      store.setAlwaysOnTop(value);
      win?.setAlwaysOnTop(value);
      return value;
    },
    openGuide: (site: GuideSite, appid, game, achievement) =>
      openUrl(guideUrl(site, appid, game, achievement, m().guides.query)),
    openExternal: (target) => openUrl(EXTERNAL[target]),
  };
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle(name, (_event, ...args: unknown[]) =>
      (fn as (...a: unknown[]) => unknown)(...args),
    );
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
    title: m().appTitle,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
    },
  });
  win.setAlwaysOnTop(store.getAlwaysOnTop());
  win.on('closed', () => (win = null));
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openUrl(url);
    return { action: 'deny' };
  });
  if (process.env.ELECTRON_RENDERER_URL)
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
}

void app.whenReady().then(() => {
  // Without a keyring (common on WSL) safeStorage would fall back to a weak scheme; the 600-permission file is used instead.
  const secure =
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' ||
      safeStorage.getSelectedStorageBackend() !== 'basic_text');
  const cipher: ICipher | null = secure
    ? {
        encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
        decrypt: (encoded) =>
          safeStorage.decryptString(Buffer.from(encoded, 'base64')),
      }
    : null;

  store = new Store(app.getPath('userData'), cipher);
  client.language = store.getLanguage();
  tracker = new Tracker({ store, client, readStatMap });

  registerIpc();
  createWindow();
  setInterval(() => void checkRunningGame(), RUNNING_CHECK_MS);
  setInterval(() => void checkUnlocks(), UNLOCK_CHECK_MS);
});

app.on('window-all-closed', () => app.quit());
