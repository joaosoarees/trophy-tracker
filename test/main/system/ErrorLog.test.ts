import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ErrorLog } from '@main/system/ErrorLog';

const file = () =>
  join(mkdtempSync(join(tmpdir(), 'tt-')), 'logs', 'errors.log');

describe('ErrorLog', () => {
  it('creates the folder and appends each error with its source and time', () => {
    const log = file();
    new ErrorLog(log).write(
      'interface: render',
      'TypeError: x is undefined\n  at Card',
    );
    new ErrorLog(log).write('main: uncaughtException', 'boom');

    const text = readFileSync(log, 'utf8');
    expect(text).toMatch(
      /^\[\d{4}-\d\d-\d\dT[^\]]+\] interface: render\nTypeError: x is undefined\n {2}at Card\n\n/,
    );
    expect(text).toContain('] main: uncaughtException\nboom\n');
  });

  it('caps a single entry', () => {
    const log = file();

    new ErrorLog(log).write('big', 'x'.repeat(50_000));

    expect(statSync(log).size).toBeLessThan(9_000);
  });

  it('rotates the file when it gets large', () => {
    const log = file();
    // The first entry creates the folder; the file is then grown by hand.
    new ErrorLog(log).write('first', 'entry');
    writeFileSync(log, 'y'.repeat(600 * 1024));

    new ErrorLog(log).write('after', 'small');

    expect(statSync(`${log}.old`).size).toBe(600 * 1024);
    expect(readFileSync(log, 'utf8')).toContain('] after\nsmall');
  });

  it('never throws, even when the file cannot be written', () => {
    // A file where a folder is expected: nothing can be created under it.
    const blocker = join(mkdtempSync(join(tmpdir(), 'tt-')), 'not-a-folder');
    writeFileSync(blocker, '');
    expect(() =>
      new ErrorLog(join(blocker, 'logs', 'errors.log')).write('s', 'd'),
    ).not.toThrow();
  });
});
