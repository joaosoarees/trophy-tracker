import { describe, expect, it } from 'vitest';

import { formatPlaytime } from '@ui/utils/format';

describe('formatPlaytime', () => {
  it.each([
    { minutes: 0, text: '0 min' },
    { minutes: 45, text: '45 min' },
    { minutes: 60, text: '1 h' },
    { minutes: 750, text: '12 h 30 min' },
  ])('writes $minutes minutes as "$text"', ({ minutes, text }) => {
    expect(formatPlaytime(minutes)).toBe(text);
  });
});
