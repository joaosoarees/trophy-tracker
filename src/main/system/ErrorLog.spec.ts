import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTempDir } from '@tests/helpers';

import { ErrorLog } from './ErrorLog';

const NOW = '2026-03-04T05:06:07.000Z';
/** Over the half megabyte at which the file is rotated. */
const LARGE_SIZE = 600 * 1024;

/** A log whose file, and the folder it is in, do not exist yet. */
function setup() {
  const file = join(makeTempDir(), 'logs', 'errors.log');
  const sut = new ErrorLog(file);
  return { sut, file };
}

/** A log whose file already holds `content`. */
function setupWithFile(content: string) {
  const { sut, file } = setup();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return { sut, file };
}

describe('ErrorLog', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('write', () => {
    it('should create the folder of the file when it does not exist', () => {
      const { sut, file } = setup();

      sut.write('main: uncaughtException', 'boom');

      expect(existsSync(dirname(file))).toBe(true);
    });

    it('should write the time, the source and the detail of the error', () => {
      const { sut, file } = setup();

      sut.write('interface: render', 'TypeError: x is undefined\n  at Card');

      expect(readFileSync(file, 'utf8')).toBe(
        `[${NOW}] interface: render\nTypeError: x is undefined\n  at Card\n\n`,
      );
    });

    it('should add the error after the ones already in the file', () => {
      const { sut, file } = setupWithFile('earlier\n\n');

      sut.write('main: uncaughtException', 'boom');

      expect(readFileSync(file, 'utf8')).toBe(
        `earlier\n\n[${NOW}] main: uncaughtException\nboom\n\n`,
      );
    });

    it('should keep the first 8000 characters when the detail is longer', () => {
      const { sut, file } = setup();

      sut.write('big', 'x'.repeat(50_000));

      expect(readFileSync(file, 'utf8')).toBe(
        `[${NOW}] big\n${'x'.repeat(8000)}\n\n`,
      );
    });

    it('should move the file to .old when it is over half a megabyte', () => {
      const { sut, file } = setupWithFile('y'.repeat(LARGE_SIZE));

      sut.write('after', 'small');

      expect(statSync(`${file}.old`).size).toBe(LARGE_SIZE);
    });

    it('should start a new file with the error when the old one was moved', () => {
      const { sut, file } = setupWithFile('y'.repeat(LARGE_SIZE));

      sut.write('after', 'small');

      expect(readFileSync(file, 'utf8')).toBe(`[${NOW}] after\nsmall\n\n`);
    });

    it('should not throw when the file cannot be written', () => {
      // A file where a folder is expected: nothing can be created under it.
      const blocker = join(makeTempDir(), 'not-a-folder');
      writeFileSync(blocker, '');
      const sut = new ErrorLog(join(blocker, 'logs', 'errors.log'));

      expect(() => sut.write('source', 'detail')).not.toThrow();
    });
  });
});
