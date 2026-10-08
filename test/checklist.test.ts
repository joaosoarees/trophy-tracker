import { describe, expect, it } from 'vitest'
import { parseChecklist, shownProgress } from '../src/shared/checklist'
import type { Achievement } from '../src/shared/types'

const achievement = (progress: Achievement['progress']): Achievement => ({
  id: 'A',
  name: 'A',
  description: '',
  hidden: false,
  icon: '',
  iconGray: '',
  rarity: null,
  unlocked: false,
  unlockedAt: null,
  progress
})

describe('parseChecklist', () => {
  it('vira um item por linha, sem marcadores, numeração nem linhas vazias', () => {
    const text = '- Kodama da ponte\n\n* Kodama da caverna\r\n3. Kodama do templo\n[ ] Kodama do rio\n  12) Kodama da torre  \n- [x] 2. Kodama do lago'
    expect(parseChecklist(text).map((i) => i.text)).toEqual([
      'Kodama da ponte',
      'Kodama da caverna',
      'Kodama do templo',
      'Kodama do rio',
      'Kodama da torre',
      'Kodama do lago'
    ])
  })

  it('preserva números que fazem parte do nome', () => {
    expect(parseChecklist('3 Kodamas na vila\nFase 2-1').map((i) => i.text)).toEqual(['3 Kodamas na vila', 'Fase 2-1'])
  })

  it('ignora repetidos, inclusive os que já estavam na lista', () => {
    const existing = [{ id: 'x', text: 'Kodama da Ponte', done: true }]
    const added = parseChecklist('kodama da ponte\nNovo\nnovo', existing)
    expect(added.map((i) => i.text)).toEqual(['Novo'])
  })

  it('cria itens desmarcados com ids distintos', () => {
    const items = parseChecklist('a\nb')
    expect(items.every((i) => !i.done)).toBe(true)
    expect(new Set(items.map((i) => i.id)).size).toBe(2)
  })
})

describe('shownProgress', () => {
  const checklist = [
    { id: '1', text: 'a', done: true },
    { id: '2', text: 'b', done: false },
    { id: '3', text: 'c', done: true }
  ]

  it('usa o checklist como contador quando a Steam não tem um', () => {
    expect(shownProgress(achievement(null), { note: '', pinned: false, checklist })).toEqual({
      current: 2,
      target: 3,
      source: 'checklist'
    })
  })

  it('dá preferência ao contador da Steam', () => {
    expect(shownProgress(achievement({ current: 5, target: 9 }), { note: '', pinned: false, checklist })).toEqual({
      current: 5,
      target: 9,
      source: 'steam'
    })
  })

  it('não mostra nada sem contador nem checklist', () => {
    expect(shownProgress(achievement(null), undefined)).toBeNull()
    expect(shownProgress(achievement(null), { note: 'x', pinned: true, checklist: [] })).toBeNull()
  })
})
