import { X } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type IChecklistItem } from '@shared/types/UserData';
import { Checkbox } from '@ui/primitives/checkbox';
import { Input } from '@ui/primitives/input';
import { cn } from '@ui/utils/cn';

interface IChecklistRowProps {
  item: IChecklistItem;
  isEditing: boolean;
  onToggle: (done: boolean) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onRename: (text: string) => void;
  onRemove: () => void;
}

export function ChecklistRow({
  item,
  isEditing,
  onToggle,
  onStartEditing,
  onCancelEditing,
  onRename,
  onRemove,
}: IChecklistRowProps) {
  const t = useT();

  return (
    <li className="group hover:bg-muted/60 -mx-1.5 flex items-center gap-2 rounded px-1.5 py-1">
      <Checkbox
        checked={item.done}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />

      {isEditing ? (
        <Input
          autoFocus
          defaultValue={item.text}
          className="h-6 flex-1 px-1.5 text-sm"
          onBlur={(event) => onRename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onRename(event.currentTarget.value);
            if (event.key === 'Escape') onCancelEditing();
          }}
        />
      ) : (
        <button
          type="button"
          title={t.checklist.rename}
          onClick={onStartEditing}
          className={cn(
            'min-w-0 flex-1 cursor-text text-left break-words select-text',
            item.done && 'text-muted-foreground line-through',
          )}
        >
          {item.text}
        </button>
      )}

      <button
        title={t.checklist.remove}
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}
