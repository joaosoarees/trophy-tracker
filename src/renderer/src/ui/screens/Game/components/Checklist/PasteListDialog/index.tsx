import { useT } from '@app/hooks/useT';
import { type IChecklistItem } from '@shared/types/UserData';
import { Button } from '@ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/primitives/dialog';
import { Textarea } from '@ui/primitives/textarea';

import { usePasteListDialogController } from './usePasteListDialogController';

interface IPasteListDialogProps {
  open: boolean;
  achievement: string;
  /** Items already on the list, to show how many of the pasted ones are new. */
  items: IChecklistItem[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (text: string) => void;
}

export function PasteListDialog({
  open,
  achievement,
  items,
  onOpenChange,
  onConfirm,
}: IPasteListDialogProps) {
  const t = useT();
  const {
    text,
    newItemCount,
    handleTextChange,
    handleOpenChange,
    handleCancel,
    handleConfirm,
  } = usePasteListDialogController({ items, onOpenChange, onConfirm });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[min(26rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{t.checklist.paste}</DialogTitle>
          <DialogDescription>
            {t.checklist.pasteDescription(achievement)}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={9}
          value={text}
          placeholder={t.checklist.pastePlaceholder}
          className="max-h-[50vh] text-sm"
          onChange={(event) => handleTextChange(event.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            {t.common.cancel}
          </Button>
          <Button disabled={newItemCount === 0} onClick={handleConfirm}>
            {newItemCount === 0
              ? t.checklist.addButton
              : t.checklist.addCount(newItemCount)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
