import { useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { useT } from '@app/hooks/useT';
import { useStore } from '@app/store';
import { createChecklistItem, parseChecklist } from '@shared/checklist';
import { type IChecklistItem } from '@shared/types/UserData';

interface IParams {
  appid: number;
  achievementId: string;
  items: IChecklistItem[];
  onChange: (items: IChecklistItem[]) => void;
}

export function useChecklistController({
  appid,
  achievementId,
  items,
  onChange,
}: IParams) {
  const t = useT();
  const { steamId, restoreItem } = useStore(
    useShallow((state) => ({
      steamId: state.settings.appState?.activeSteamId ?? null,
      restoreItem: state.userData.restoreChecklistItem,
    })),
  );

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

  /** Removing is instant, so it can be taken back: the item was typed by hand. */
  function handleRemove(id: string) {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return;
    const removed = items[index];
    onChange(items.filter((item) => item.id !== id));
    // With no account in use nothing was removed for anyone.
    if (steamId === null) return;

    // The toast outlives this list (a collapsed card, a search, another game
    // or account), so the undo names where the item came from and the store
    // puts it back into the list as it is at the click.
    const from = { steamId, appid, achievementId };
    toast(t.checklist.removed(removed.text), {
      action: {
        label: t.common.undo,
        onClick: () => restoreItem(from, removed, index),
      },
    });
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
    handleRemove,
  };
}
