/** `owner/name` of the GitHub repository whose releases carry the installers. */
export const RELEASES_REPOSITORY = 'joaosoarees/trophy-tracker';

interface IDownloadTarget {
  /** The version to download; `null` when no newer one is known. */
  version: string | null;
  platform?: NodeJS.Platform;
  arch?: string;
}

/**
 * Where the "Download" button of the update notice leads. On macOS, which
 * cannot update itself, it is the disk image for this Mac's processor (named
 * as in `electron-builder.yml`), so the user does not have to pick it from
 * the release page; everywhere else, and when no version is known, it is the
 * page of the latest release.
 */
export function downloadUrl({
  version,
  platform = process.platform,
  arch = process.arch,
}: IDownloadTarget): string {
  const releases = `https://github.com/${RELEASES_REPOSITORY}/releases`;
  if (version === null || platform !== 'darwin') return `${releases}/latest`;

  const processor = arch === 'arm64' ? 'arm64' : 'x64';
  return `${releases}/download/v${version}/Trophy-Tracker-${version}-macOS-${processor}.dmg`;
}
