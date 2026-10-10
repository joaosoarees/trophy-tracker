import { describe, expect, it } from 'vitest';

import { BinaryVdf } from './BinaryVdf';

const END = Buffer.from([8]);

const str = (s: string) =>
  Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
const obj = (key: string, ...children: Buffer[]) =>
  Buffer.concat([Buffer.from([0]), str(key), ...children, END]);
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

/**
 * A game's schema as the Steam client keeps it: a plain stat, and a stat whose
 * bits are the achievements, of which only `ACH_001` has a counter. The
 * default of the plain stat needs all 32 bits and the sign to be read right.
 */
function makeSchema(): Buffer {
  return Buffer.concat([
    obj(
      '3681010',
      obj(
        'stats',
        obj(
          '3',
          text('type', 'INT'),
          text('name', 'ACH_001_PROGRESS'),
          int('default', -70000),
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
    END,
  ]);
}

describe('BinaryVdf', () => {
  describe('parse', () => {
    it('should read the objects, strings and integers of a file', () => {
      const file = makeSchema();

      const root = BinaryVdf.parse(file);

      expect(root).toEqual({
        '3681010': {
          stats: {
            '3': { type: 'INT', name: 'ACH_001_PROGRESS', default: -70000 },
            '1376': {
              type: 4,
              bits: {
                '0': { name: 'ACH_000' },
                '3': {
                  name: 'ACH_001',
                  progress: {
                    min_val: 0,
                    max_val: 39,
                    value: {
                      operation: 'statvalue',
                      operand1: 'ACH_001_PROGRESS',
                    },
                  },
                },
              },
            },
          },
          gamename: 'Nioh 3',
        },
      });
    });

    it('should throw and say where when the file has a type it does not know', () => {
      const unknown = Buffer.concat([Buffer.from([5]), str('wide'), str('x')]);
      const file = Buffer.concat([text('gamename', 'Nioh 3'), unknown, END]);

      expect(() => BinaryVdf.parse(file)).toThrow(
        new Error('Unknown VDF type 5 at position 17'),
      );
    });

    it('should throw when the file is truncated', () => {
      const file = makeSchema().subarray(0, 40);

      expect(() => BinaryVdf.parse(file)).toThrow(
        new Error('Truncated binary VDF'),
      );
    });
  });

  describe('achievementStatMap', () => {
    it('should link only the achievement with a counter to its stat', () => {
      const schema = BinaryVdf.parse(makeSchema());

      const statMap = BinaryVdf.achievementStatMap(schema);

      expect(statMap).toEqual(new Map([['ACH_001', 'ACH_001_PROGRESS']]));
    });
  });
});
