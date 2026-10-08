import { contextBridge, ipcRenderer } from 'electron';

import type { IApi } from '../shared/types';

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
  'checkSteamId',
  'checkApiKey',
  'checkPrivacy',
  'saveConfig',
  'resetConfig',
  'getCurrentAppId',
  'getGame',
  'getDashboard',
  'getUserData',
  'setUserData',
  'setLanguage',
  'getAlwaysOnTop',
  'setAlwaysOnTop',
  'openGuide',
  'openExternal',
] as const;

const api = {
  ...Object.fromEntries(calls.map((c) => [c, invoke(c)])),
  onGameChanged: listen('game-changed'),
  onGameUpdated: listen('game-updated'),
  onDashboardProgress: listen('dashboard-progress'),
} as unknown as IApi;

contextBridge.exposeInMainWorld('api', api);
