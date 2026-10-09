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

const calls = [
  'getState',
  'detectSteamId',
  'checkApiKey',
  'checkPrivacy',
  'saveConfig',
  'resetConfig',
  'setActiveAccount',
  'removeAccount',
  'replaceKey',
  'recheckAccount',
  'getCurrentAppId',
  'getGame',
  'getDashboard',
  'getUserData',
  'setUserData',
  'setLanguage',
  'setAchievementSort',
  'setDashboardSort',
  'getAlwaysOnTop',
  'setAlwaysOnTop',
  'getPreferences',
  'setPreference',
  'getDataFolder',
  'openDataFolder',
  'openGuide',
  'openExternal',
  'getAppInfo',
  'checkForUpdates',
  'installUpdate',
  'logError',
] as const;

const api = {
  ...Object.fromEntries(calls.map((c) => [c, invoke(c)])),
  onStateChanged: listen(IpcEvent.stateChanged),
  onGameChanged: listen(IpcEvent.gameChanged),
  onGameUpdated: listen(IpcEvent.gameUpdated),
  onDashboardProgress: listen(IpcEvent.dashboardProgress),
  onAppInfoChanged: listen(IpcEvent.appInfoChanged),
} as unknown as IApi;

contextBridge.exposeInMainWorld('api', api);
