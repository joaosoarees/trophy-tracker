import { shell } from 'electron';

import { type ExternalPage } from '@shared/types/Guide';

import { Windows } from '../steam/Windows';

import { Releases } from './Releases';

/** `download` is not here: where it leads depends on the version found (see `Releases.downloadUrl`). */
const EXTERNAL_PAGES: Record<Exclude<ExternalPage, 'download'>, string> = {
  apikey: 'https://steamcommunity.com/dev/apikey',
  privacy: 'https://steamcommunity.com/my/edit/settings',
  account: 'https://store.steampowered.com/account/',
  source: `https://github.com/${Releases.REPOSITORY}`,
  issues: `https://github.com/${Releases.REPOSITORY}/issues`,
  license: `https://github.com/${Releases.REPOSITORY}/blob/main/LICENSE`,
  smartAppControl:
    'https://support.microsoft.com/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions',
};

/** The user's browser; from WSL that means the Windows one. */
export class Browser {
  constructor(private readonly windows: Windows) {}

  open(url: string): Promise<void> {
    return Windows.isWsl
      ? this.windows.openInBrowser(url)
      : shell.openExternal(url);
  }

  openPage(page: Exclude<ExternalPage, 'download'>): Promise<void> {
    return this.open(EXTERNAL_PAGES[page]);
  }
}
