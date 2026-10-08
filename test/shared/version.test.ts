import { describe, expect, it } from 'vitest';

import { isNewerVersion } from '@shared/version';

describe('isNewerVersion', () => {
  it('compares each part as a number', () => {
    expect(isNewerVersion('1.10.0', '1.9.3')).toBe(true);
    expect(isNewerVersion('v2.0.0', '1.9.3')).toBe(true);
    expect(isNewerVersion('1.2.0', '1.2.0')).toBe(false);
    expect(isNewerVersion('1.1.9', '1.2.0')).toBe(false);
  });

  it('never offers a pre-release or a malformed tag', () => {
    expect(isNewerVersion('2.0.0-beta.1', '1.0.0')).toBe(false);
    expect(isNewerVersion('latest', '1.0.0')).toBe(false);
    expect(isNewerVersion('', '1.0.0')).toBe(false);
  });
});
