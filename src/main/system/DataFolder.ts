import { clipboard, shell } from 'electron';

import { type IDataFolder } from '@shared/types/Preferences';

import { Windows } from '../steam/Windows';

/**
 * The app's data folder as the user can reach it. Inside WSL the folder
 * belongs to Linux and there is usually no file manager to show it, so its
 * path goes to the clipboard instead.
 */
export class DataFolder {
  constructor(
    private readonly path: string,
    private readonly canOpen = !Windows.isWsl,
  ) {}

  describe(): IDataFolder {
    return { path: this.path, canOpen: this.canOpen };
  }

  /** Opens the folder in the file manager or, where that cannot be done, copies its path. */
  async open(): Promise<'opened' | 'copied'> {
    if (this.canOpen && (await shell.openPath(this.path)) === '') {
      return 'opened';
    }
    await clipboard.writeText(this.path);
    return 'copied';
  }
}
