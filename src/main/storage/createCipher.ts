import { safeStorage } from 'electron';

import { secureCipher } from './secureCipher';
import { type ICipher } from './Store';

/** The cipher backed by Electron's storage on this system (see `secureCipher`). */
export function createCipher(): ICipher | null {
  return secureCipher(safeStorage, process.platform);
}
