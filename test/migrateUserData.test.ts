import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { migrateUserData } from '../src/main/storage/migrateUserData';

const dir = () => mkdtempSync(join(tmpdir(), 'tt-'));

describe('migrateUserData', () => {
  it('copies the data files the first time the new folder is used', () => {
    const from = dir();
    const to = join(dir(), 'trophy-tracker');
    writeFileSync(join(from, 'config.json'), '{"steamId":"1"}');
    writeFileSync(join(from, 'userdata.json'), '{"10":{}}');
    writeFileSync(join(from, 'Cookies'), 'browser state, not ours');

    expect(migrateUserData(from, to)).toEqual(['config.json', 'userdata.json']);
    expect(readFileSync(join(to, 'config.json'), 'utf8')).toBe(
      '{"steamId":"1"}',
    );
    // The old folder is left as it was.
    expect(readFileSync(join(from, 'config.json'), 'utf8')).toBe(
      '{"steamId":"1"}',
    );
  });

  it('does nothing when the new folder is already set up', () => {
    const from = dir();
    const to = dir();
    writeFileSync(join(from, 'config.json'), '{"steamId":"old"}');
    writeFileSync(join(to, 'config.json'), '{"steamId":"new"}');

    expect(migrateUserData(from, to)).toEqual([]);
    expect(readFileSync(join(to, 'config.json'), 'utf8')).toBe(
      '{"steamId":"new"}',
    );
  });

  it('does nothing when there was no earlier install', () => {
    expect(migrateUserData(join(dir(), 'missing'), dir())).toEqual([]);
  });
});
