import { shell } from 'electron';

import { type ExternalPage } from '@shared/types/Guide';

import { RELEASES_REPOSITORY } from '../services/releases';
import { isWsl, openInWindowsBrowser } from '../steam/windows';

const EXTERNAL_PAGES: Record<ExternalPage, string> = {
  apikey: 'https://steamcommunity.com/dev/apikey',
  privacy: 'https://steamcommunity.com/my/edit/settings',
  account: 'https://store.steampowered.com/account/',
  download: `https://github.com/${RELEASES_REPOSITORY}/releases/latest`,
  smartAppControl:
    'https://support.microsoft.com/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions',
};

/** Opens in the user's browser; from WSL that means the Windows one. */
export function openUrl(url: string): Promise<void> {
  return isWsl ? openInWindowsBrowser(url) : shell.openExternal(url);
}

export function openExternalPage(page: ExternalPage): Promise<void> {
  return openUrl(EXTERNAL_PAGES[page]);
}
