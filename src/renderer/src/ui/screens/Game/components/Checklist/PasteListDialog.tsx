import { useState } from 'react';

import { useT } from '@app/hooks/useT';
import { parseChecklist } from '@shared/checklist';
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
  const [text, setText] = useState('');
  const newItems = parseChecklist(text, items).length;

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setText('');
  }

  function handleConfirm() {
    onConfirm(text);
    setText('');
  }

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
          onChange={(event) => setText(event.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button disabled={newItems === 0} onClick={handleConfirm}>
            {newItems === 0
              ? t.checklist.addButton
              : t.checklist.addCount(newItems)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
