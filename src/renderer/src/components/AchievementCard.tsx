import { BookOpen, CirclePlay, EyeOff, ListChecks, Pin, Search, StickyNote } from 'lucide-react'
import { memo, useState, type ReactNode } from 'react'
import { shownProgress } from '../../../shared/checklist'
import type { Achievement, AchievementUserData, GuideSite } from '../../../shared/types'
import { Checklist } from '@/components/Checklist'
import { ProgressBar } from '@/components/bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const GUIDES: { site: GuideSite; label: string; icon: ReactNode }[] = [
  { site: 'steam', label: 'Guias', icon: <BookOpen /> },
  { site: 'youtube', label: 'YouTube', icon: <CirclePlay /> },
  { site: 'google', label: 'Google', icon: <Search /> }
]

const date = (epoch: number): string =>
  new Date(epoch * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const number = (n: number): string => n.toLocaleString('pt-BR')

interface Props {
  a: Achievement
  game: string
  appid: number
  data: AchievementUserData | undefined
  onChange(id: string, patch: Partial<AchievementUserData>): void
}

export const AchievementCard = memo(function AchievementCard({ a, game, appid, data, onChange }: Props) {
  const checklist = data?.checklist ?? []
  const note = data?.note ?? ''
  const pinned = data?.pinned === true
  const [noteOpen, setNoteOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const showNote = noteOpen || note !== ''
  const progress = a.unlocked ? null : shownProgress(a, data)
  const done = checklist.filter((i) => i.done).length

  return (
    <li
      className={cn(
        'bg-card flex gap-3 rounded-lg border p-3 transition-colors',
        pinned && 'border-warning/60',
        a.unlocked && 'opacity-90'
      )}
    >
      <img
        src={a.unlocked ? a.icon : a.iconGray || a.icon}
        alt=""
        loading="lazy"
        className="bg-muted size-12 flex-none rounded-md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 leading-snug font-semibold">{a.name}</h3>
          {a.hidden && (
            <Badge variant="outline" className="text-warning border-warning/40 gap-1 px-1.5 py-0 text-[10px]">
              <EyeOff className="size-3" />
              oculta
            </Badge>
          )}
          {a.rarity !== null && (
            <span className="text-muted-foreground pt-0.5 text-xs tabular-nums" title="Jogadores que têm esta conquista">
              {a.rarity.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </span>
          )}
        </div>
        <p className="text-foreground/75 mt-0.5 select-text">{a.description || 'Sem descrição.'}</p>

        {progress && (
          <div className="mt-2 flex items-center gap-2.5" title={progress.source === 'checklist' ? 'Itens marcados no seu checklist' : 'Contador da Steam'}>
            <ProgressBar value={(progress.current / progress.target) * 100} className="flex-1" />
            <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
              {progress.source === 'checklist' && <ListChecks className="size-3" />}
              {number(progress.current)} / {number(progress.target)}
            </span>
          </div>
        )}

        {a.unlocked ? (
          a.unlockedAt && <p className="text-muted-foreground mt-1.5 text-xs">Obtida em {date(a.unlockedAt)}</p>
        ) : (
          <div className="mt-2.5 flex flex-wrap items-center gap-1">
            {GUIDES.map(({ site, label, icon }) => (
              <Button
                key={site}
                size="xs"
                variant="secondary"
                title={site === 'steam' ? 'Buscar nos guias da comunidade Steam' : `Buscar no ${label}`}
                onClick={() => void window.api.openGuide(site, appid, game, a.name)}
              >
                {icon}
                {label}
              </Button>
            ))}
            <span className="flex-1" />
            <Button
              size="xs"
              variant={listOpen ? 'default' : 'ghost'}
              title="Checklist do que falta"
              onClick={() => setListOpen(!listOpen)}
            >
              <ListChecks />
              {checklist.length > 0 ? `${done}/${checklist.length}` : 'Lista'}
            </Button>
            {!showNote && (
              <Button size="icon-xs" variant="ghost" title="Anotar" onClick={() => setNoteOpen(true)}>
                <StickyNote />
              </Button>
            )}
            <Button
              size="icon-xs"
              variant="ghost"
              title={pinned ? 'Desafixar' : 'Fixar no topo'}
              className={cn(pinned && 'text-warning hover:text-warning')}
              onClick={() => onChange(a.id, { pinned: !pinned })}
            >
              <Pin className={cn(pinned && 'fill-current')} />
            </Button>
          </div>
        )}

        {listOpen && !a.unlocked && (
          <Checklist achievement={a.name} items={checklist} onChange={(items) => onChange(a.id, { checklist: items })} />
        )}

        {showNote && (
          <Textarea
            value={note}
            rows={2}
            autoFocus={noteOpen && note === ''}
            placeholder="Sua anotação ou um link de guia"
            className="mt-2.5 min-h-0 text-sm"
            onChange={(e) => onChange(a.id, { note: e.target.value })}
            onBlur={() => setNoteOpen(false)}
          />
        )}
      </div>
    </li>
  )
})
