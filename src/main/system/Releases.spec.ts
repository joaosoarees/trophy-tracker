import { describe, expect, it } from 'vitest';

import { Releases } from './Releases';

const RELEASES = 'https://github.com/joaosoarees/trophy-tracker/releases';

describe('Releases', () => {
  describe('downloadUrl', () => {
    it.each([
      ['arm64', 'Trophy-Tracker-1.2.0-macOS-arm64.dmg'],
      ['x64', 'Trophy-Tracker-1.2.0-macOS-x64.dmg'],
    ])(
      'should lead to the disk image of the processor when the Mac has an %s one',
      (arch, file) => {
        const url = Releases.downloadUrl({
          version: '1.2.0',
          platform: 'darwin',
          arch,
        });

        expect(url).toBe(`${RELEASES}/download/v1.2.0/${file}`);
      },
    );

    it.each(['win32', 'linux'] as const)(
      'should lead to the page of the latest release when the system is %s',
      (platform) => {
        const url = Releases.downloadUrl({
          version: '1.2.0',
          platform,
          arch: 'x64',
        });

        expect(url).toBe(`${RELEASES}/latest`);
      },
    );

    it('should lead to the page of the latest release when no version is known', () => {
      const url = Releases.downloadUrl({
        version: null,
        platform: 'darwin',
        arch: 'arm64',
      });

      expect(url).toBe(`${RELEASES}/latest`);
    });
  });
});
