import { type ICipher } from './Store';

/** The part of Electron's `safeStorage` the cipher uses. */
export interface ISecureStorage {
  isEncryptionAvailable: () => boolean;
  /** Linux only: which keyring holds the encryption key. */
  getSelectedStorageBackend: () => string;
  encryptString: (plain: string) => Buffer;
  decryptString: (encrypted: Buffer) => string;
}

/**
 * Cipher for the Web API key, or `null` when the system cannot provide a real
 * one. Without a keyring (common on WSL) the storage would fall back to a
 * weak scheme (`basic_text`); the 600-permission file is used instead.
 */
export function secureCipher(
  storage: ISecureStorage,
  platform: NodeJS.Platform,
): ICipher | null {
  const isSecure =
    storage.isEncryptionAvailable() &&
    (platform !== 'linux' ||
      storage.getSelectedStorageBackend() !== 'basic_text');

  if (!isSecure) return null;

  return {
    encrypt: (plain) => storage.encryptString(plain).toString('base64'),
    decrypt: (encoded) => storage.decryptString(Buffer.from(encoded, 'base64')),
  };
}
