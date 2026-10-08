import { clipboard, shell } from 'electron';

import { type IDataFolder } from '@shared/types/Preferences';

import { isWsl } from '../steam/windows';

export interface IDataFolderAccess {
  describe: () => IDataFolder;
  /** Opens the folder in the file manager or, where that cannot be done, copies its path. */
  open: () => Promise<'opened' | 'copied'>;
}

/**
 * The app's data folder as the user can reach it. Inside WSL the folder
 * belongs to Linux and there is usually no file manager to show it, so its
 * path goes to the clipboard instead.
 */
export function createDataFolderAccess(path: string): IDataFolderAccess {
  const canOpen = !isWsl;
  return {
    describe: () => ({ path, canOpen }),
    open: async () => {
      if (canOpen && (await shell.openPath(path)) === '') return 'opened';
      await clipboard.writeText(path);
      return 'copied';
    },
  };
}
