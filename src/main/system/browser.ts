import { shell } from 'electron';

import { type ExternalPage } from '@shared/types/Guide';

import { RELEASES_REPOSITORY } from '../services/releases';
import { isWsl, openInWindowsBrowser } from '../steam/windows';

/** `download` is not here: where it leads depends on the version found (see `downloadUrl`). */
const EXTERNAL_PAGES: Record<Exclude<ExternalPage, 'download'>, string> = {
  apikey: 'https://steamcommunity.com/dev/apikey',
  privacy: 'https://steamcommunity.com/my/edit/settings',
  account: 'https://store.steampowered.com/account/',
  source: `https://github.com/${RELEASES_REPOSITORY}`,
  issues: `https://github.com/${RELEASES_REPOSITORY}/issues`,
  license: `https://github.com/${RELEASES_REPOSITORY}/blob/main/LICENSE`,
  smartAppControl:
    'https://support.microsoft.com/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions',
};

/** Opens in the user's browser; from WSL that means the Windows one. */
export function openUrl(url: string): Promise<void> {
  return isWsl ? openInWindowsBrowser(url) : shell.openExternal(url);
}

export function openExternalPage(
  page: Exclude<ExternalPage, 'download'>,
): Promise<void> {
  return openUrl(EXTERNAL_PAGES[page]);
}
