import { describe, expect, it } from 'vitest';

import { downloadUrl } from '@main/services/releases';

const RELEASES = 'https://github.com/joaosoarees/trophy-tracker/releases';

describe('downloadUrl', () => {
  it.each([
    ['arm64', 'Trophy-Tracker-1.2.0-macOS-arm64.dmg'],
    ['x64', 'Trophy-Tracker-1.2.0-macOS-x64.dmg'],
  ])('leads a Mac with an %s processor to its own disk image', (arch, file) => {
    const url = downloadUrl({ version: '1.2.0', platform: 'darwin', arch });

    expect(url).toBe(`${RELEASES}/download/v1.2.0/${file}`);
  });

  it.each(['win32', 'linux'] as const)(
    'leads to the page of the latest release on %s',
    (platform) => {
      const url = downloadUrl({ version: '1.2.0', platform, arch: 'x64' });

      expect(url).toBe(`${RELEASES}/latest`);
    },
  );

  it('leads to the page of the latest release when no version is known', () => {
    const url = downloadUrl({
      version: null,
      platform: 'darwin',
      arch: 'arm64',
    });

    expect(url).toBe(`${RELEASES}/latest`);
  });
});
