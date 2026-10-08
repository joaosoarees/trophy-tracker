export type VdfValue = string | number | bigint | VdfObject;
export interface VdfObject {
  [key: string]: VdfValue;
}

const T = {
  Object: 0,
  String: 1,
  Int32: 2,
  Float32: 3,
  UInt64: 7,
  End: 8,
  Int64: 10,
} as const;

/** Reads the binary KeyValues format the Steam client uses in appcache/stats. */
export function parseBinaryVdf(buf: Buffer): VdfObject {
  let pos = 0;

  const readString = (): string => {
    const end = buf.indexOf(0, pos);
    if (end === -1) throw new Error('Truncated binary VDF');
    const s = buf.toString('utf8', pos, end);
    pos = end + 1;
    return s;
  };

  const readObject = (): VdfObject => {
    const obj: VdfObject = {};
    for (;;) {
      if (pos >= buf.length) throw new Error('Truncated binary VDF');
      const type = buf[pos++];
      if (type === T.End) return obj;
      const key = readString();
      switch (type) {
        case T.Object:
          obj[key] = readObject();
          break;
        case T.String:
          obj[key] = readString();
          break;
        case T.Int32:
          obj[key] = buf.readInt32LE(pos);
          pos += 4;
          break;
        case T.Float32:
          obj[key] = buf.readFloatLE(pos);
          pos += 4;
          break;
        case T.UInt64:
          obj[key] = buf.readBigUInt64LE(pos);
          pos += 8;
          break;
        case T.Int64:
          obj[key] = buf.readBigInt64LE(pos);
          pos += 8;
          break;
        default:
          throw new Error(`Unknown VDF type ${type} at position ${pos - 1}`);
      }
    }
  };

  return readObject();
}

const isObject = (v: VdfValue | undefined): v is VdfObject =>
  typeof v === 'object' && v !== null;

/**
 * From a game's local schema, extracts which stat feeds each achievement's counter
 * (the public Web API does not expose that link).
 */
export function achievementStatMap(schema: VdfObject): Map<string, string> {
  const map = new Map<string, string>();
  for (const app of Object.values(schema)) {
    if (!isObject(app) || !isObject(app.stats)) continue;
    for (const stat of Object.values(app.stats)) {
      if (!isObject(stat) || !isObject(stat.bits)) continue;
      for (const bit of Object.values(stat.bits)) {
        if (
          !isObject(bit) ||
          typeof bit.name !== 'string' ||
          !isObject(bit.progress)
        )
          continue;
        const value = bit.progress.value;
        if (
          isObject(value) &&
          value.operation === 'statvalue' &&
          typeof value.operand1 === 'string'
        ) {
          map.set(bit.name, value.operand1);
        }
      }
    }
  }
  return map;
}
