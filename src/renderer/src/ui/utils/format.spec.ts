import { describe, expect, it } from 'vitest';

import { formatPlaytime } from './format';

describe('format', () => {
  describe('formatPlaytime', () => {
    it.each([
      { minutes: 0, text: '0 min' },
      { minutes: 45, text: '45 min' },
      { minutes: 60, text: '1 h' },
      { minutes: 750, text: '12 h 30 min' },
    ])(
      'should write "$text" when given $minutes minutes',
      ({ minutes, text }) => {
        const playtime = formatPlaytime(minutes);

        expect(playtime).toBe(text);
      },
    );
  });
});
