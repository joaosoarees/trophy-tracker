import { ClipboardPaste, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { parseChecklist } from '../../../shared/checklist';
import type { ChecklistItem } from '../../../shared/types';

interface Props {
  achievement: string;
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

export function Checklist({ achievement, items, onChange }: Props) {
  const t = useT();
  const locale = useLocale();
  const [draft, setDraft] = useState('');
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const add = (text: string): void => {
    const added = parseChecklist(text, items);
    if (added.length > 0) onChange([...items, ...added]);
  };
  /** A hand-typed item goes in as written; if it already exists, the text stays in the field with a warning. */
  const addDraft = (): void => {
    const text = draft.trim();
    if (text === '') return;
    const key = text.toLocaleLowerCase(locale);
    if (items.some((i) => i.text.toLocaleLowerCase(locale) === key))
      return setDuplicate(true);
    onChange([
      ...items,
      { id: `${Date.now().toString(36)}-${items.length}`, text, done: false },
    ]);
    setDraft('');
  };
  const patch = (id: string, change: Partial<ChecklistItem>): void =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...change } : i)));
  const rename = (id: string, text: string): void => {
    setEditing(null);
    if (text.trim() !== '') patch(id, { text: text.trim() });
  };

  // Pending first: what is missing is what matters.
  const ordered = [...items].sort((a, b) => Number(a.done) - Number(b.done));
  const preview = parseChecklist(pasted, items).length;

  return (
    <div className="mt-2.5 space-y-1.5">
      {ordered.length > 0 && (
        <ul className="space-y-0.5">
          {ordered.map((item) => (
            <li
              key={item.id}
              className="group hover:bg-muted/60 -mx-1.5 flex items-center gap-2 rounded px-1.5 py-1"
            >
              <Checkbox
                checked={item.done}
                onCheckedChange={(v) => patch(item.id, { done: v === true })}
              />
              {editing === item.id ? (
                <Input
                  autoFocus
                  defaultValue={item.text}
                  className="h-6 flex-1 px-1.5 text-sm"
                  onBlur={(e) => rename(item.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      rename(item.id, e.currentTarget.value);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  title={t.checklist.rename}
                  onClick={() => setEditing(item.id)}
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
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <Input
          value={draft}
          placeholder={t.checklist.newItem}
          className="h-7 flex-1 text-sm"
          aria-invalid={duplicate}
          onChange={(e) => {
            setDraft(e.target.value);
            setDuplicate(false);
          }}
          onKeyDown={(e) => {
            // An Enter that only confirms an accent or a composition does not add anything.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) addDraft();
          }}
        />
        <Button
          size="icon-sm"
          variant="secondary"
          className="size-7"
          title={t.checklist.add}
          disabled={draft.trim() === ''}
          onClick={addDraft}
        >
          <Plus />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => setPasting(true)}
        >
          <ClipboardPaste />
          {t.checklist.paste}
        </Button>
      </div>

      {duplicate && (
        <p className="text-warning text-xs">{t.checklist.duplicate}</p>
      )}

      <Dialog
        open={pasting}
        onOpenChange={(open) => {
          setPasting(open);
          if (!open) setPasted('');
        }}
      >
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
            value={pasted}
            placeholder={t.checklist.pastePlaceholder}
            className="max-h-[50vh] text-sm"
            onChange={(e) => setPasted(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasting(false)}>
              {t.common.cancel}
            </Button>
            <Button
              disabled={preview === 0}
              onClick={() => {
                add(pasted);
                setPasting(false);
                setPasted('');
              }}
            >
              {preview === 0
                ? t.checklist.addButton
                : t.checklist.addCount(preview)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
