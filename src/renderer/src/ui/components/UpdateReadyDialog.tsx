import { useT } from '@app/hooks/useT';
import { Button } from '@ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/primitives/dialog';

interface IUpdateReadyDialogProps {
  open: boolean;
  version: string;
  onRestart: () => void;
  onLater: () => void;
}

/** A version finished downloading while the app was in use: restarting is the user's call. */
export function UpdateReadyDialog({
  open,
  version,
  onRestart,
  onLater,
}: IUpdateReadyDialogProps) {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onLater()}>
      <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{t.update.readyTitle(version)}</DialogTitle>
          <DialogDescription>{t.update.readyDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onLater}>
            {t.update.later}
          </Button>
          <Button onClick={onRestart}>{t.update.restartNow}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
