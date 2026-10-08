import { safeStorage } from 'electron';

import { type ICipher } from './Store';

/**
 * Cipher for the Web API key, or `null` when the system cannot provide a real
 * one. Without a keyring (common on WSL) safeStorage would fall back to a weak
 * scheme; the 600-permission file is used instead.
 */
export function createCipher(): ICipher | null {
  const isSecure =
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' ||
      safeStorage.getSelectedStorageBackend() !== 'basic_text');

  if (!isSecure) return null;

  return {
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (encoded) =>
      safeStorage.decryptString(Buffer.from(encoded, 'base64')),
  };
}
