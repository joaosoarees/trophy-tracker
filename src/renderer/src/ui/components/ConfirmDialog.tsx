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

interface IConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question, naming what is about to be lost. */
  title: string;
  /** What exactly is deleted, and what is kept. */
  description: string;
  /** The verb on the destructive button. */
  confirmLabel: string;
  onConfirm: () => void;
}

/** Asks before something is deleted for good. Cancel is the way out; the destructive button says what it does. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: IConfirmDialogProps) {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
