import { useState } from 'react';

import { parseChecklist } from '@shared/checklist';
import { type IChecklistItem } from '@shared/types/UserData';

interface IParams {
  items: IChecklistItem[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (text: string) => void;
}

export function usePasteListDialogController({
  items,
  onOpenChange,
  onConfirm,
}: IParams) {
  const [text, setText] = useState('');

  /** What was pasted does not wait for the next time the dialog opens. */
  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) setText('');
  }

  function handleConfirm() {
    onConfirm(text);
    setText('');
  }

  return {
    text,
    newItemCount: parseChecklist(text, items).length,
    handleTextChange: setText,
    handleOpenChange,
    handleCancel: () => handleOpenChange(false),
    handleConfirm,
  };
}
