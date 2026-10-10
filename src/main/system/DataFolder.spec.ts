import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { makeTempDir } from '@tests/helpers';

import { DataFolder } from './DataFolder';

describe('DataFolder', () => {
  describe('canWrite', () => {
    it('should say yes when a file can be kept in the folder', () => {
      const folder = makeTempDir();

      const canWrite = DataFolder.canWrite(folder);

      expect(canWrite).toBe(true);
    });

    it('should leave nothing in the folder when it has tried it', () => {
      const folder = makeTempDir();

      DataFolder.canWrite(folder);

      expect(readdirSync(folder)).toEqual([]);
    });

    it('should create the folder when it does not exist yet', () => {
      const folder = join(makeTempDir(), 'trophy-tracker');

      const canWrite = DataFolder.canWrite(folder);

      expect(canWrite).toBe(true);
      expect(existsSync(folder)).toBe(true);
    });

    it('should say no when the folder cannot be created', () => {
      // A file where a folder is expected: nothing can be created under it,
      // on any system and whoever runs the tests.
      const blocker = join(makeTempDir(), 'not-a-folder');
      writeFileSync(blocker, '');

      const canWrite = DataFolder.canWrite(join(blocker, 'trophy-tracker'));

      expect(canWrite).toBe(false);
    });
  });
});
