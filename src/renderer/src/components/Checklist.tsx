import { ClipboardPaste, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { parseChecklist } from '../../../shared/checklist'
import type { ChecklistItem } from '../../../shared/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface Props {
  achievement: string
  items: ChecklistItem[]
  onChange(items: ChecklistItem[]): void
}

export function Checklist({ achievement, items, onChange }: Props) {
  const [draft, setDraft] = useState('')
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)

  const add = (text: string): void => {
    const added = parseChecklist(text, items)
    if (added.length > 0) onChange([...items, ...added])
  }
  /** Item digitado à mão entra como foi escrito; se já existe, o texto fica no campo com um aviso. */
  const addDraft = (): void => {
    const text = draft.trim()
    if (text === '') return
    const key = text.toLocaleLowerCase('pt-BR')
    if (items.some((i) => i.text.toLocaleLowerCase('pt-BR') === key)) return setDuplicate(true)
    onChange([...items, { id: `${Date.now().toString(36)}-${items.length}`, text, done: false }])
    setDraft('')
  }
  const patch = (id: string, change: Partial<ChecklistItem>): void =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...change } : i)))
  const rename = (id: string, text: string): void => {
    setEditing(null)
    if (text.trim() !== '') patch(id, { text: text.trim() })
  }

  // Pendentes primeiro: o que falta é o que interessa.
  const ordered = [...items].sort((a, b) => Number(a.done) - Number(b.done))
  const preview = parseChecklist(pasted, items).length

  return (
    <div className="mt-2.5 space-y-1.5">
      {ordered.length > 0 && (
        <ul className="space-y-0.5">
          {ordered.map((item) => (
            <li key={item.id} className="group hover:bg-muted/60 -mx-1.5 flex items-center gap-2 rounded px-1.5 py-1">
              <Checkbox checked={item.done} onCheckedChange={(v) => patch(item.id, { done: v === true })} />
              {editing === item.id ? (
                <Input
                  autoFocus
                  defaultValue={item.text}
                  className="h-6 flex-1 px-1.5 text-sm"
                  onBlur={(e) => rename(item.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename(item.id, e.currentTarget.value)
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <span
                  title="Clique para renomear"
                  onClick={() => setEditing(item.id)}
                  className={cn('min-w-0 flex-1 cursor-text break-words', item.done && 'text-muted-foreground line-through')}
                >
                  {item.text}
                </span>
              )}
              <button
                title="Remover item"
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
          placeholder="Novo item"
          className="h-7 flex-1 text-sm"
          aria-invalid={duplicate}
          onChange={(e) => {
            setDraft(e.target.value)
            setDuplicate(false)
          }}
          onKeyDown={(e) => {
            // Enter que só confirma um acento ou composição não adiciona.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) addDraft()
          }}
        />
        <Button
          size="icon-sm"
          variant="secondary"
          className="size-7"
          title="Adicionar item"
          disabled={draft.trim() === ''}
          onClick={addDraft}
        >
          <Plus />
        </Button>
        <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setPasting(true)}>
          <ClipboardPaste />
          Colar lista
        </Button>
      </div>

      {duplicate && <p className="text-warning text-xs">Esse item já está na lista.</p>}

      <Dialog
        open={pasting}
        onOpenChange={(open) => {
          setPasting(open)
          if (!open) setPasted('')
        }}
      >
        <DialogContent className="max-w-[min(26rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Colar lista</DialogTitle>
            <DialogDescription>
              Cole os itens de um guia para “{achievement}”, um por linha. Marcadores e numeração são removidos.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={9}
            value={pasted}
            placeholder={'Item 1\nItem 2\nItem 3'}
            className="max-h-[50vh] text-sm"
            onChange={(e) => setPasted(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasting(false)}>
              Cancelar
            </Button>
            <Button
              disabled={preview === 0}
              onClick={() => {
                add(pasted)
                setPasting(false)
                setPasted('')
              }}
            >
              {preview === 0 ? 'Adicionar' : `Adicionar ${preview} ${preview === 1 ? 'item' : 'itens'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
