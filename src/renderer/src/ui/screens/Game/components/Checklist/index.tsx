import { ClipboardPaste, Plus } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type IChecklistItem } from '@shared/types/UserData';
import { IconButton } from '@ui/components/IconButton';
import { Button } from '@ui/primitives/button';
import { Input } from '@ui/primitives/input';

import { ChecklistRow } from './ChecklistRow';
import { PasteListDialog } from './PasteListDialog';
import { useChecklistController } from './useChecklistController';

interface IChecklistProps {
  appid: number;
  achievementId: string;
  /** The achievement's name, for the dialog that takes a pasted list. */
  achievement: string;
  items: IChecklistItem[];
  onChange: (items: IChecklistItem[]) => void;
}

export function Checklist({
  appid,
  achievementId,
  achievement,
  items,
  onChange,
}: IChecklistProps) {
  const t = useT();
  const {
    orderedItems,
    draft,
    isDuplicate,
    isPasting,
    editingId,
    handlePastingChange,
    handleEditingChange,
    handleDraftChange,
    handleAddDraft,
    handlePaste,
    handleRename,
    handleToggle,
    handleRemove,
  } = useChecklistController({ appid, achievementId, items, onChange });

  return (
    <div className="mt-2.5 space-y-1.5">
      {orderedItems.length > 0 && (
        <ul className="space-y-0.5">
          {orderedItems.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              isEditing={editingId === item.id}
              onToggle={(done) => handleToggle(item.id, done)}
              onStartEditing={() => handleEditingChange(item.id)}
              onCancelEditing={() => handleEditingChange(null)}
              onRename={(text) => handleRename(item.id, text)}
              onRemove={() => handleRemove(item.id)}
            />
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <Input
          value={draft}
          placeholder={t.checklist.newItem}
          className="h-7 flex-1 text-sm"
          aria-invalid={isDuplicate}
          onChange={(event) => handleDraftChange(event.target.value)}
          onKeyDown={(event) => {
            // An Enter that only confirms an accent or a composition does not add anything.
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              handleAddDraft();
            }
          }}
        />
        <IconButton
          variant="secondary"
          className="size-7"
          label={t.checklist.add}
          disabled={draft.trim() === ''}
          onClick={handleAddDraft}
        >
          <Plus />
        </IconButton>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => handlePastingChange(true)}
        >
          <ClipboardPaste />
          {t.checklist.paste}
        </Button>
      </div>

      {isDuplicate && (
        <p className="text-destructive text-xs">{t.checklist.duplicate}</p>
      )}

      <PasteListDialog
        open={isPasting}
        achievement={achievement}
        items={items}
        onOpenChange={handlePastingChange}
        onConfirm={handlePaste}
      />
    </div>
  );
}
