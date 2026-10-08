import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

const listen = (channel: string) => (cb: (...args: any[]) => void) => {
  const handler = (_e: unknown, ...args: unknown[]): void => cb(...args)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

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
  'openGuide',
  'openExternal'
] as const

const api = {
  ...Object.fromEntries(calls.map((c) => [c, invoke(c)])),
  onGameChanged: listen('game-changed'),
  onGameUpdated: listen('game-updated'),
  onDashboardProgress: listen('dashboard-progress')
} as unknown as Api

contextBridge.exposeInMainWorld('api', api)
