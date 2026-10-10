import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
} from 'node:fs';
import { dirname } from 'node:path';

const MAX_BYTES = 512 * 1024;

/**
 * A local log file of errors, so there is something to look at when a user
 * reports a problem. Nothing is sent anywhere. The file is rotated once
 * (to `.old`) when it grows past half a megabyte.
 */
export class ErrorLog {
  constructor(private readonly file: string) {}

  write(source: string, detail: string): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      if (existsSync(this.file) && statSync(this.file).size > MAX_BYTES) {
        renameSync(this.file, `${this.file}.old`);
      }
      appendFileSync(
        this.file,
        `[${new Date().toISOString()}] ${source}\n${detail.trim().slice(0, 8000)}\n\n`,
      );
    } catch {
      // Logging must never be the thing that breaks the app.
    }
  }
}
