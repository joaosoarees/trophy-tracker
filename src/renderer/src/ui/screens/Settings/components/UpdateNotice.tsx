import { Download, RotateCw } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type UpdateStatus } from '@shared/types/AppInfo';
import { Button } from '@ui/primitives/button';

interface IUpdateNoticeProps {
  version: string;
  status: UpdateStatus;
  onDownload: () => void;
  onInstall: () => void;
}

export function UpdateNotice({
  version,
  status,
  onDownload,
  onInstall,
}: IUpdateNoticeProps) {
  const t = useT();
  const title = {
    manual: t.settings.updateAvailable(version),
    downloading: t.settings.updateDownloading(version),
    ready: t.settings.updateReady(version),
  }[status];

  return (
    <div
      role="status"
      className="border-primary/40 bg-primary/10 flex w-full items-center gap-3 rounded-md border p-3"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        {status === 'manual' && (
          <small className="text-muted-foreground">
            {t.settings.updateHint}
          </small>
        )}
        {status === 'ready' && (
          <small className="text-muted-foreground">
            {t.settings.updateReadyHint}
          </small>
        )}
      </div>
      {status === 'manual' && (
        <Button size="sm" onClick={onDownload}>
          <Download />
          {t.settings.download}
        </Button>
      )}
      {status === 'ready' && (
        <Button size="sm" onClick={onInstall}>
          <RotateCw />
          {t.settings.restart}
        </Button>
      )}
    </div>
  );
}
