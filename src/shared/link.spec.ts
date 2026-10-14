import { describe, expect, it } from 'vitest';

import { linkHost, parseLink } from './link';

describe('link', () => {
  describe('parseLink', () => {
    it.each([
      {
        kind: 'a video with its minute',
        text: 'https://www.youtube.com/watch?v=abc123&t=95s',
        link: 'https://www.youtube.com/watch?v=abc123&t=95s',
      },
      {
        kind: 'an address with no scheme',
        text: 'youtu.be/abc123?t=95',
        link: 'https://youtu.be/abc123?t=95',
      },
      {
        kind: 'an address with spaces around it',
        text: '  https://steamcommunity.com/sharedfiles/filedetails/?id=1\n',
        link: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1',
      },
      {
        kind: 'a scheme in capitals',
        text: 'HTTPS://Example.com/Guide',
        link: 'https://example.com/Guide',
      },
      {
        kind: 'a host with a port',
        text: 'example.com:8443/guide',
        link: 'https://example.com:8443/guide',
      },
    ])('should answer the https address of $kind', ({ text, link }) => {
      const parsed = parseLink(text);

      expect(parsed).toBe(link);
    });

    it.each([
      { kind: 'nothing', text: '' },
      { kind: 'only spaces', text: '   ' },
      { kind: 'an http address', text: 'http://example.com/guide' },
      { kind: 'a file', text: 'file:///etc/passwd' },
      { kind: 'a script', text: 'javascript:alert(1)' },
      { kind: 'another program', text: 'steam://run/440' },
      { kind: 'a host with no dot', text: 'https://localhost/guide' },
      { kind: 'a word being typed', text: 'youtube' },
      { kind: 'a host that ends in a dot', text: 'https://example./guide' },
      { kind: 'a user in the address', text: 'https://user@example.com' },
      {
        kind: 'a password in the address',
        text: 'https://user:secret@example.com',
      },
      { kind: 'two words', text: 'example.com my guide' },
      {
        kind: 'text too long',
        text: `https://example.com/${'a'.repeat(2000)}`,
      },
    ])('should answer no address for $kind', ({ text }) => {
      const parsed = parseLink(text);

      expect(parsed).toBeNull();
    });
  });

  describe('linkHost', () => {
    it('should leave out www when the host starts with it', () => {
      const host = linkHost('https://www.youtube.com/watch?v=abc123');

      expect(host).toBe('youtube.com');
    });

    it('should answer the whole host when it has no www', () => {
      const host = linkHost('https://steamcommunity.com/sharedfiles/1');

      expect(host).toBe('steamcommunity.com');
    });
  });
});
