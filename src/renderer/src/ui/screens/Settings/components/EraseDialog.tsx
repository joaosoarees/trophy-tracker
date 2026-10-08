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

interface IEraseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function EraseDialog({
  open,
  onOpenChange,
  onConfirm,
}: IEraseDialogProps) {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{t.settings.eraseTitle}</DialogTitle>
          <DialogDescription>{t.settings.eraseDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t.settings.eraseConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
