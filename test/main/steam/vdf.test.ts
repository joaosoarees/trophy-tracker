import { describe, expect, it } from 'vitest';

import { achievementStatMap, parseBinaryVdf } from '@main/steam/vdf';

describe('binary VDF', () => {
  const str = (s: string) =>
    Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
  const obj = (key: string, ...children: Buffer[]) =>
    Buffer.concat([Buffer.from([0]), str(key), ...children, Buffer.from([8])]);
  const text = (key: string, value: string) =>
    Buffer.concat([Buffer.from([1]), str(key), str(value)]);
  const int = (key: string, value: number) => {
    const b = Buffer.alloc(4);
    b.writeInt32LE(value);
    return Buffer.concat([Buffer.from([2]), str(key), b]);
  };
  const bit = (n: string, name: string, ...extra: Buffer[]) =>
    obj(n, text('name', name), ...extra);
  const progress = (stat: string) =>
    obj(
      'progress',
      int('min_val', 0),
      int('max_val', 39),
      obj('value', text('operation', 'statvalue'), text('operand1', stat)),
    );

  const schema = Buffer.concat([
    obj(
      '3681010',
      obj(
        'stats',
        obj(
          '3',
          text('type', 'INT'),
          text('name', 'ACH_001_PROGRESS'),
          int('default', 0),
        ),
        obj(
          '1376',
          int('type', 4),
          obj(
            'bits',
            bit('0', 'ACH_000'),
            bit('3', 'ACH_001', progress('ACH_001_PROGRESS')),
          ),
        ),
      ),
      text('gamename', 'Nioh 3'),
    ),
    Buffer.from([8]),
  ]);

  it('reads objects, strings and integers', () => {
    const root = parseBinaryVdf(schema) as any;
    expect(root['3681010'].gamename).toBe('Nioh 3');
    expect(root['3681010'].stats['1376'].bits['3'].progress.max_val).toBe(39);
  });

  it('links each counted achievement to its stat', () => {
    expect([...achievementStatMap(parseBinaryVdf(schema))]).toEqual([
      ['ACH_001', 'ACH_001_PROGRESS'],
    ]);
  });

  it('rejects a truncated file', () => {
    expect(() => parseBinaryVdf(schema.subarray(0, 40))).toThrow();
  });
});
