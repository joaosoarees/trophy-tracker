import { Download } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { Button } from '@ui/primitives/button';

interface IUpdateNoticeProps {
  version: string;
  onDownload: () => void;
}

export function UpdateNotice({ version, onDownload }: IUpdateNoticeProps) {
  const t = useT();

  return (
    <div
      role="status"
      className="border-primary/40 bg-primary/10 flex w-full items-center gap-3 rounded-md border p-3"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">
          {t.settings.updateAvailable(version)}
        </span>
        <small className="text-muted-foreground">{t.settings.updateHint}</small>
      </div>
      <Button size="sm" onClick={onDownload}>
        <Download />
        {t.settings.download}
      </Button>
    </div>
  );
}
