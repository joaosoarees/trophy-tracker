import { describe, expect, it } from 'vitest';

import { isNewerVersion } from './version';

describe('version', () => {
  describe('isNewerVersion', () => {
    it.each([
      { part: 'major', candidate: 'v2.0.0', current: '1.9.3' },
      { part: 'minor', candidate: '1.10.0', current: '1.9.3' },
      { part: 'patch', candidate: '1.2.10', current: '1.2.9' },
    ])(
      'should answer true when the $part part is a higher number: $candidate after $current',
      ({ candidate, current }) => {
        const isNewer = isNewerVersion(candidate, current);

        expect(isNewer).toBe(true);
      },
    );

    it.each([
      { relation: 'the same as', candidate: '1.2.0', current: '1.2.0' },
      { relation: 'older than', candidate: '1.1.9', current: '1.2.0' },
    ])(
      'should answer false when the candidate is $relation the current: $candidate after $current',
      ({ candidate, current }) => {
        const isNewer = isNewerVersion(candidate, current);

        expect(isNewer).toBe(false);
      },
    );

    it.each(['2.0.0-beta.1', 'latest', ''])(
      'should answer false when the candidate is a pre-release or a malformed tag: "%s"',
      (candidate) => {
        const isNewer = isNewerVersion(candidate, '1.0.0');

        expect(isNewer).toBe(false);
      },
    );
  });
});
