import { Download, ExternalLink, RotateCw } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type UpdateStatus } from '@shared/types/AppInfo';
import { Notice } from '@ui/components/Notice';
import { Button } from '@ui/primitives/button';

interface IUpdateNoticeProps {
  version: string;
  status: UpdateStatus;
  onDownload: () => void;
  onInstall: () => void;
  onLearnMore: () => void;
}

export function UpdateNotice({
  version,
  status,
  onDownload,
  onInstall,
  onLearnMore,
}: IUpdateNoticeProps) {
  const t = useT();
  const title = {
    manual: t.settings.updateAvailable(version),
    downloading: t.settings.updateDownloading(version),
    ready: t.settings.updateReady(version),
    blocked: t.settings.updateAvailable(version),
  }[status];
  const hint = {
    manual: t.settings.updateHint,
    downloading: undefined,
    ready: t.settings.updateReadyHint,
    blocked: t.settings.updateBlockedHint,
  }[status];

  return (
    <Notice title={title} description={hint}>
      {status === 'manual' && (
        <Button size="sm" onClick={onDownload}>
          <Download />
          {t.settings.download}
        </Button>
      )}
      {status === 'blocked' && (
        <Button size="sm" variant="outline" onClick={onLearnMore}>
          <ExternalLink />
          {t.settings.learnMore}
        </Button>
      )}
      {status === 'ready' && (
        <Button size="sm" onClick={onInstall}>
          <RotateCw />
          {t.settings.restart}
        </Button>
      )}
    </Notice>
  );
}
