import { X } from 'lucide-react';

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
        aria-label={item.text}
        checked={item.done}
        className="hover:border-primary"
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
        <Hint label={t.checklist.rename} side="top">
          <Pressable
            onClick={onStartEditing}
            className={cn(
              'hover:bg-accent/50 min-w-0 flex-1 cursor-text rounded-sm px-1 text-left wrap-break-word select-text active:scale-100',
              item.done && 'text-muted-foreground line-through',
            )}
          >
            {item.text}
          </Pressable>
        </Hint>
      )}

      <Hint label={t.checklist.remove}>
        <Pressable
          aria-label={t.checklist.remove}
          onClick={onRemove}
          // Also shown on keyboard focus: hover alone would hide it from the keyboard.
          className="text-muted-foreground hover:bg-accent hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-3.5" />
        </Pressable>
      </Hint>
    </li>
  );
}
