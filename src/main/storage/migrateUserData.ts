import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const FILES = ['config.json', 'settings.json', 'userdata.json', 'cache.json'];

/**
 * The app used to be called "steam-trophy-tracker" and kept its data in a
 * folder of that name. Copies it over once, the first time the new folder is
 * used. The old folder is left alone, so nothing is lost if this goes wrong.
 * Returns the files that were copied.
 */
export function migrateUserData(from: string, to: string): string[] {
  // Anything already set up in the new place wins.
  if (existsSync(join(to, 'config.json')) || !existsSync(from)) return [];

  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const file of FILES) {
    const source = join(from, file);
    if (!existsSync(source)) continue;
    copyFileSync(source, join(to, file));
    copied.push(file);
  }
  return copied;
}
