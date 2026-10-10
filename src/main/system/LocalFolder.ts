import { mkdirSync } from 'node:fs';

import { clipboard, shell } from 'electron';

import { type ILocalFolder } from '@shared/types/Preferences';

import { Windows } from '../steam/Windows';

/**
 * A folder of the app as the user can reach it: the path shown for it and
 * the button that opens it. Inside WSL the folder belongs to Linux and there
 * is usually no file manager to show it, so the path goes to the clipboard
 * instead.
 */
export class LocalFolder {
  constructor(
    private readonly folder: string,
    /** What is shown and copied: the folder, or a file inside it. */
    private readonly path = folder,
    private readonly canOpen = !Windows.isWsl,
  ) {}

  describe(): ILocalFolder {
    return { path: this.path, canOpen: this.canOpen };
  }

  /** Opens the folder in the file manager or, where that cannot be done, copies the path. */
  async open(): Promise<'opened' | 'copied'> {
    if (this.canOpen && (await this.show()) === '') return 'opened';
    await clipboard.writeText(this.path);
    return 'copied';
  }

  /** Answers an empty text when the folder was opened, as Electron does. */
  private async show(): Promise<string> {
    try {
      // The error log's folder only exists once something was logged.
      mkdirSync(this.folder, { recursive: true });
    } catch {
      // Opening it says what is wrong.
    }
    return shell.openPath(this.folder);
  }
}
