import { Notification } from 'electron';

import { isWsl, windowsToast } from '../steam/windows';

/**
 * Shows a system notification. Inside WSL the Electron one never reaches the
 * Windows notification area, so the toast is raised through PowerShell.
 */
export function notify(title: string, body: string): void {
  if (isWsl) {
    void windowsToast(title, body).catch(() => {});
    return;
  }
  if (Notification.isSupported()) new Notification({ title, body }).show();
}
