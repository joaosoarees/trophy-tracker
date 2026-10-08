import { Pencil, X } from 'lucide-react';
import { useId } from 'react';

import { useT } from '@app/hooks/useT';
import { type IChecklistItem } from '@shared/types/UserData';
import { Hint } from '@ui/components/Hint';
import { Pressable } from '@ui/components/Pressable';
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

// Shown on hover and on keyboard focus: hover alone would hide them from the keyboard.
const ROW_ACTION =
  'text-muted-foreground hover:bg-accent p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100';

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
  const id = useId();

  return (
    <li className="group hover:bg-muted/60 -mx-1.5 flex items-center gap-2 rounded px-1.5">
      <Checkbox
        id={id}
        checked={item.done}
        className="hover:border-primary"
        onCheckedChange={(checked) => onToggle(checked === true)}
      />

      {isEditing ? (
        <Input
          autoFocus
          aria-label={t.checklist.rename}
          defaultValue={item.text}
          className="my-1 h-6 flex-1 px-1.5 text-sm"
          onBlur={(event) => onRename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onRename(event.currentTarget.value);
            if (event.key === 'Escape') onCancelEditing();
          }}
        />
      ) : (
        // The text is the checkbox's label: clicking anywhere on it checks
        // the item, which is what is done most, mid-game.
        <label
          htmlFor={id}
          className={cn(
            'min-w-0 flex-1 cursor-pointer py-1 wrap-break-word',
            item.done && 'text-muted-foreground line-through',
          )}
        >
          {item.text}
        </label>
      )}

      {!isEditing && (
        <Hint label={t.checklist.rename}>
          <Pressable
            aria-label={t.checklist.rename}
            onClick={onStartEditing}
            className={cn(ROW_ACTION, 'hover:text-foreground')}
          >
            <Pencil className="size-4" />
          </Pressable>
        </Hint>
      )}
      <Hint label={t.checklist.remove}>
        <Pressable
          aria-label={t.checklist.remove}
          onClick={onRemove}
          className={cn(ROW_ACTION, 'hover:text-destructive')}
        >
          <X className="size-4" />
        </Pressable>
      </Hint>
    </li>
  );
}
