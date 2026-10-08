import { useState } from 'react';

import { createChecklistItem, parseChecklist } from '@shared/checklist';
import { type IChecklistItem } from '@shared/types';

export function useChecklistController(
  items: IChecklistItem[],
  onChange: (items: IChecklistItem[]) => void,
) {
  const [draft, setDraft] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function patch(id: string, change: Partial<IChecklistItem>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    setIsDuplicate(false);
  }

  /** If the item already exists, the text stays in the field with a warning. */
  function handleAddDraft() {
    const item = createChecklistItem(draft, items);
    if (item === 'blank') return;
    if (item === 'duplicate') {
      setIsDuplicate(true);
      return;
    }

    onChange([...items, item]);
    setDraft('');
  }

  function handlePaste(text: string) {
    const added = parseChecklist(text, items);
    if (added.length > 0) onChange([...items, ...added]);
    setIsPasting(false);
  }

  function handleRename(id: string, text: string) {
    setEditingId(null);
    if (text.trim() !== '') patch(id, { text: text.trim() });
  }

  return {
    // Pending first: what is missing is what matters.
    orderedItems: [...items].sort((a, b) => Number(a.done) - Number(b.done)),
    draft,
    isDuplicate,
    isPasting,
    editingId,
    setIsPasting,
    setEditingId,
    handleDraftChange,
    handleAddDraft,
    handlePaste,
    handleRename,
    handleToggle: (id: string, done: boolean) => patch(id, { done }),
    handleRemove: (id: string) =>
      onChange(items.filter((item) => item.id !== id)),
  };
}
