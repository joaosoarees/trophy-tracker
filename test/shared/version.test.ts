import { describe, expect, it } from 'vitest';

import { isNewerVersion } from '@shared/version';

describe('isNewerVersion', () => {
  it.each([
    { candidate: '1.10.0', current: '1.9.3', newer: true },
    { candidate: 'v2.0.0', current: '1.9.3', newer: true },
    { candidate: '1.2.0', current: '1.2.0', newer: false },
    { candidate: '1.1.9', current: '1.2.0', newer: false },
  ])(
    'compares each part as a number: $candidate after $current is $newer',
    ({ candidate, current, newer }) => {
      expect(isNewerVersion(candidate, current)).toBe(newer);
    },
  );

  it.each(['2.0.0-beta.1', 'latest', ''])(
    'never offers a pre-release or a malformed tag: "%s"',
    (candidate) => {
      expect(isNewerVersion(candidate, '1.0.0')).toBe(false);
    },
  );
});
