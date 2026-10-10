import { type ICipher } from './Store';

/** The part of Electron's `safeStorage` the cipher uses. */
export interface ISecureStorage {
  isEncryptionAvailable: () => boolean;
  /** Linux only: which keyring holds the encryption key. */
  getSelectedStorageBackend: () => string;
  encryptString: (plain: string) => Buffer;
  decryptString: (encrypted: Buffer) => string;
}

/** Cipher for the Web API key, backed by the system's own storage. */
export class SecureCipher implements ICipher {
  private constructor(private readonly storage: ISecureStorage) {}

  /**
   * The cipher, or `null` when the system cannot provide a real one. Without
   * a keyring (common on WSL) the storage would fall back to a weak scheme
   * (`basic_text`); the 600-permission file is used instead.
   */
  static create(
    storage: ISecureStorage,
    platform: NodeJS.Platform,
  ): SecureCipher | null {
    const isSecure =
      storage.isEncryptionAvailable() &&
      (platform !== 'linux' ||
        storage.getSelectedStorageBackend() !== 'basic_text');

    return isSecure ? new SecureCipher(storage) : null;
  }

  encrypt(plain: string): string {
    return this.storage.encryptString(plain).toString('base64');
  }

  decrypt(encoded: string): string {
    return this.storage.decryptString(Buffer.from(encoded, 'base64'));
  }
}
