import { describe, expect, it } from 'vitest';

import {
  createChecklistItem,
  parseChecklist,
  shownProgress,
} from '../src/shared/checklist';
import { type IAchievement } from '../src/shared/types/Achievement';

const achievement = (progress: IAchievement['progress']): IAchievement => ({
  id: 'A',
  name: 'A',
  description: '',
  hidden: false,
  icon: '',
  iconGray: '',
  rarity: null,
  unlocked: false,
  unlockedAt: null,
  progress,
});

describe('parseChecklist', () => {
  it('turns each line into an item, dropping bullets, numbering and blank lines', () => {
    const text =
      '- Bridge Kodama\n\n* Cave Kodama\r\n3. Temple Kodama\n[ ] River Kodama\n  12) Tower Kodama  \n- [x] 2. Lake Kodama';
    expect(parseChecklist(text).map((i) => i.text)).toEqual([
      'Bridge Kodama',
      'Cave Kodama',
      'Temple Kodama',
      'River Kodama',
      'Tower Kodama',
      'Lake Kodama',
    ]);
  });

  it('keeps numbers that are part of the name', () => {
    expect(
      parseChecklist('3 Kodamas in the village\nStage 2-1').map((i) => i.text),
    ).toEqual(['3 Kodamas in the village', 'Stage 2-1']);
  });

  it('ignores duplicates, including the ones already on the list', () => {
    const existing = [{ id: 'x', text: 'Bridge Kodama', done: true }];
    const added = parseChecklist('bridge kodama\nNew\nnew', existing);
    expect(added.map((i) => i.text)).toEqual(['New']);
  });

  it('creates unchecked items with distinct ids', () => {
    const items = parseChecklist('a\nb');
    expect(items.every((i) => !i.done)).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });
});

describe('shownProgress', () => {
  const checklist = [
    { id: '1', text: 'a', done: true },
    { id: '2', text: 'b', done: false },
    { id: '3', text: 'c', done: true },
  ];

  it('uses the checklist as the counter when Steam has none', () => {
    expect(
      shownProgress(achievement(null), { note: '', pinned: false, checklist }),
    ).toEqual({
      current: 2,
      target: 3,
      source: 'checklist',
    });
  });

  it('prefers the Steam counter', () => {
    expect(
      shownProgress(achievement({ current: 5, target: 9 }), {
        note: '',
        pinned: false,
        checklist,
      }),
    ).toEqual({
      current: 5,
      target: 9,
      source: 'steam',
    });
  });

  it('shows nothing without a counter or a checklist', () => {
    expect(shownProgress(achievement(null), undefined)).toBeNull();
    expect(
      shownProgress(achievement(null), {
        note: 'x',
        pinned: true,
        checklist: [],
      }),
    ).toBeNull();
  });
});

describe('createChecklistItem', () => {
  const existing = [{ id: 'x', text: 'Bridge Kodama', done: true }];

  it('keeps hand-typed text exactly as written, bullets and all', () => {
    expect(createChecklistItem('  1. First boss ', existing)).toMatchObject({
      text: '1. First boss',
      done: false,
    });
  });

  it('refuses blank text and items already on the list', () => {
    expect(createChecklistItem('   ', existing)).toBe('blank');
    expect(createChecklistItem('bridge kodama', existing)).toBe('duplicate');
  });
});
