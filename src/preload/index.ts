import { contextBridge, ipcRenderer } from 'electron';

import { IpcEvent } from '@shared/ipcEvents';
import { type IApi } from '@shared/types/Api';

const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args);

const listen = (channel: string) => (cb: (...args: never[]) => void) => {
  const handler = (_e: unknown, ...args: unknown[]): void =>
    cb(...(args as never[]));
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
};

/** What the interface asks: every member of `IApi` that is not an event. */
type Call = Exclude<keyof IApi, `on${string}`>;

/**
 * Every call, by name. The compiler holds the list to `IApi`: a call that is
 * missing here, or a name `IApi` does not have, does not build. As a plain
 * list cast to `IApi`, a forgotten name built, passed every test and failed
 * in the window, where `window.api` had no such function.
 */
const calls: Record<Call, true> = {
  getState: true,
  detectSteamId: true,
  checkApiKey: true,
  checkPrivacy: true,
  addAccount: true,
  setActiveAccount: true,
  removeAccount: true,
  replaceKey: true,
  recheckAccount: true,
  getCurrentAppId: true,
  getGame: true,
  getDashboard: true,
  getUserData: true,
  setUserData: true,
  setLanguage: true,
  setTheme: true,
  paintWindow: true,
  setAchievementSort: true,
  setDashboardSort: true,
  getAlwaysOnTop: true,
  setAlwaysOnTop: true,
  getPreferences: true,
  setPreference: true,
  getFolder: true,
  openFolder: true,
  openGuide: true,
  openLink: true,
  openExternal: true,
  getAppInfo: true,
  checkForUpdates: true,
  installUpdate: true,
  logError: true,
};

const api: IApi = {
  ...(Object.fromEntries(
    Object.keys(calls).map((call) => [call, invoke(call)]),
  ) as Pick<IApi, Call>),
  onStateChanged: listen(IpcEvent.stateChanged),
  onGameChanged: listen(IpcEvent.gameChanged),
  onGameUpdated: listen(IpcEvent.gameUpdated),
  onDashboardProgress: listen(IpcEvent.dashboardProgress),
  onAppInfoChanged: listen(IpcEvent.appInfoChanged),
};

contextBridge.exposeInMainWorld('api', api);
