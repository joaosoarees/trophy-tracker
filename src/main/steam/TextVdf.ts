export interface ITextVdf {
  [key: string]: string | ITextVdf;
}

/** Valve's text KeyValues format. */
export class TextVdf {
  /**
   * Reads Valve's text KeyValues format (`"key" "value"` pairs and
   * `"key" { ... }` blocks), used by files such as `config/loginusers.vdf`.
   */
  static parse(text: string): ITextVdf {
    const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}]/g) ?? [];
    let position = 0;

    const unquote = (token: string): string =>
      token.slice(1, -1).replace(/\\(.)/g, '$1');

    const readBlock = (): ITextVdf => {
      const block: ITextVdf = {};
      while (position < tokens.length) {
        const token = tokens[position++];
        if (token === '}') break;
        if (token === '{') continue;

        const key = unquote(token);
        const next = tokens[position];
        if (next === '{') {
          position++;
          block[key] = readBlock();
        } else if (next !== undefined && next !== '}') {
          position++;
          block[key] = unquote(next);
        }
      }
      return block;
    };

    return readBlock();
  }
}
