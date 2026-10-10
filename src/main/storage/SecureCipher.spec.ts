import { describe, expect, it } from 'vitest';

import { type ISecureStorage, SecureCipher } from '@main/storage/SecureCipher';

/** A system storage that "encrypts" by reversing the text, so the result is checkable. */
const storage = (over: Partial<ISecureStorage> = {}): ISecureStorage => ({
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'gnome_libsecret',
  encryptString: (plain) => Buffer.from([...plain].reverse().join('')),
  decryptString: (encrypted) => [...encrypted.toString()].reverse().join(''),
  ...over,
});

describe('SecureCipher', () => {
  it('encrypts through the system storage and reads the value back', () => {
    const cipher = SecureCipher.create(storage(), 'win32');

    const encoded = cipher?.encrypt('0123456789ABCDEF');

    expect(encoded).not.toContain('0123456789ABCDEF');
    expect(cipher?.decrypt(encoded ?? '')).toBe('0123456789ABCDEF');
  });

  it('stores the encrypted value as text that fits in a JSON file', () => {
    const encoded = SecureCipher.create(storage(), 'darwin')?.encrypt('key');

    expect(encoded).toBe(Buffer.from('yek').toString('base64'));
  });

  it('offers no cipher when the system cannot encrypt', () => {
    const unavailable = storage({ isEncryptionAvailable: () => false });

    expect(SecureCipher.create(unavailable, 'win32')).toBeNull();
  });

  it('offers no cipher on Linux without a keyring, where the storage would only disguise the key', () => {
    const noKeyring = storage({
      getSelectedStorageBackend: () => 'basic_text',
    });

    expect(SecureCipher.create(noKeyring, 'linux')).toBeNull();
  });

  it('uses the keyring on Linux when there is one', () => {
    expect(SecureCipher.create(storage(), 'linux')).not.toBeNull();
  });

  it.each(['win32', 'darwin'] as const)(
    'does not ask which keyring is in use on %s',
    (platform) => {
      const strict = storage({
        getSelectedStorageBackend: () => {
          throw new Error('only exists on Linux');
        },
      });

      expect(SecureCipher.create(strict, platform)).not.toBeNull();
    },
  );
});
