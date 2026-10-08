/** Channels the main process uses to push events to the interface. */
export const IpcEvent = {
  gameChanged: 'game-changed',
  gameUpdated: 'game-updated',
  dashboardProgress: 'dashboard-progress',
  appInfoChanged: 'app-info-changed',
} as const;

export type IpcEvent = (typeof IpcEvent)[keyof typeof IpcEvent];
