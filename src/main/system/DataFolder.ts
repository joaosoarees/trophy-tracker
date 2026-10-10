import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The folder the app keeps its files in, as the system lets it be used. */
export class DataFolder {
  /**
   * Whether the app can keep files in the folder, which is created when it
   * does not exist: a file is written there and removed. Asked only when the
   * app cannot open, to tell a folder that refuses from any other reason.
   */
  static canWrite(folder: string): boolean {
    const trial = join(folder, `.write-test-${process.pid}`);
    try {
      mkdirSync(folder, { recursive: true });
      writeFileSync(trial, '');
      rmSync(trial);
      return true;
    } catch {
      return false;
    }
  }
}
