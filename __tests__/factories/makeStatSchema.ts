const str = (s: string) =>
  Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
const obj = (key: string, ...children: Buffer[]) =>
  Buffer.concat([Buffer.from([0]), str(key), ...children, Buffer.from([8])]);
const text = (key: string, value: string) =>
  Buffer.concat([Buffer.from([1]), str(key), str(value)]);

/**
 * The file the Steam client keeps per game (`UserGameStatsSchema_<appid>.bin`),
 * with just enough in it to link each given achievement to the stat that
 * feeds its counter.
 */
export function makeStatSchema(
  appid: number,
  counters: Record<string, string>,
): Buffer {
  const bits = Object.entries(counters).map(([achievement, stat], index) =>
    obj(
      String(index),
      text('name', achievement),
      obj(
        'progress',
        obj('value', text('operation', 'statvalue'), text('operand1', stat)),
      ),
    ),
  );
  return Buffer.concat([
    obj(String(appid), obj('stats', obj('1', obj('bits', ...bits)))),
    Buffer.from([8]),
  ]);
}
