import { describe, expect, it } from 'vitest';

import { type ISecureStorage, SecureCipher } from './SecureCipher';

/** What the fake storage below makes of `key`, as the cipher stores it. */
const ENCODED_KEY = Buffer.from('yek').toString('base64');

/** A system storage that "encrypts" by reversing the text, so the result is checkable. */
const makeStorage = (over: Partial<ISecureStorage> = {}): ISecureStorage => ({
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'gnome_libsecret',
  encryptString: (plain) => Buffer.from([...plain].reverse().join('')),
  decryptString: (encrypted) => [...encrypted.toString()].reverse().join(''),
  ...over,
});

/** The cipher of a system that can encrypt. */
function setup() {
  const sut = SecureCipher.create(makeStorage(), 'win32');
  if (!sut) throw new Error('setup: the storage offered no cipher');
  return { sut };
}

describe('SecureCipher', () => {
  describe('create', () => {
    it('should offer no cipher when the system cannot encrypt', () => {
      const storage = makeStorage({ isEncryptionAvailable: () => false });

      const cipher = SecureCipher.create(storage, 'win32');

      expect(cipher).toBeNull();
    });

    it('should offer no cipher when Linux has no keyring, where the storage would only disguise the key', () => {
      const storage = makeStorage({
        getSelectedStorageBackend: () => 'basic_text',
      });

      const cipher = SecureCipher.create(storage, 'linux');

      expect(cipher).toBeNull();
    });

    it('should offer a cipher when Linux has a keyring', () => {
      const storage = makeStorage();

      const cipher = SecureCipher.create(storage, 'linux');

      expect(cipher).toBeInstanceOf(SecureCipher);
    });

    it.each(['win32', 'darwin'] as const)(
      'should offer a cipher without asking which keyring is in use when on %s',
      (platform) => {
        const storage = makeStorage({
          getSelectedStorageBackend: () => {
            throw new Error('only exists on Linux');
          },
        });

        const cipher = SecureCipher.create(storage, platform);

        expect(cipher).toBeInstanceOf(SecureCipher);
      },
    );
  });

  describe('encrypt', () => {
    it('should answer what the system storage encrypted as text that fits in a JSON file', () => {
      const { sut } = setup();

      const encoded = sut.encrypt('key');

      expect(encoded).toBe(ENCODED_KEY);
    });
  });

  describe('decrypt', () => {
    it('should answer the value the system storage reads back from the stored text', () => {
      const { sut } = setup();

      const plain = sut.decrypt(ENCODED_KEY);

      expect(plain).toBe('key');
    });
  });
});
