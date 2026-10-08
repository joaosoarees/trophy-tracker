import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { logError } from '../src/main/system/errorLog';

const file = () =>
  join(mkdtempSync(join(tmpdir(), 'tt-')), 'logs', 'errors.log');

describe('logError', () => {
  it('creates the folder and appends each error with its source and time', () => {
    const log = file();
    logError(log, 'interface: render', 'TypeError: x is undefined\n  at Card');
    logError(log, 'main: uncaughtException', 'boom');

    const text = readFileSync(log, 'utf8');
    expect(text).toMatch(
      /^\[\d{4}-\d\d-\d\dT[^\]]+\] interface: render\nTypeError: x is undefined\n {2}at Card\n\n/,
    );
    expect(text).toContain('] main: uncaughtException\nboom\n');
  });

  it('caps a single entry and rotates the file when it gets large', () => {
    const log = file();
    logError(log, 'big', 'x'.repeat(50_000));
    expect(statSync(log).size).toBeLessThan(9_000);

    writeFileSync(log, 'y'.repeat(600 * 1024));
    logError(log, 'after', 'small');
    expect(statSync(`${log}.old`).size).toBe(600 * 1024);
    expect(readFileSync(log, 'utf8')).toContain('] after\nsmall');
  });

  it('never throws, even when the file cannot be written', () => {
    // A file where a folder is expected: nothing can be created under it.
    const blocker = join(mkdtempSync(join(tmpdir(), 'tt-')), 'not-a-folder');
    writeFileSync(blocker, '');
    expect(() =>
      logError(join(blocker, 'logs', 'errors.log'), 's', 'd'),
    ).not.toThrow();
  });
});
