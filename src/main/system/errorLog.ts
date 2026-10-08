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
 * Appends an error to a local log file, so there is something to look at when
 * a user reports a problem. Nothing is sent anywhere. The file is rotated once
 * (to `.old`) when it grows past half a megabyte.
 */
export function logError(file: string, source: string, detail: string): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    if (existsSync(file) && statSync(file).size > MAX_BYTES) {
      renameSync(file, `${file}.old`);
    }
    appendFileSync(
      file,
      `[${new Date().toISOString()}] ${source}\n${detail.trim().slice(0, 8000)}\n\n`,
    );
  } catch {
    // Logging must never be the thing that breaks the app.
  }
}
