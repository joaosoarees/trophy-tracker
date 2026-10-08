import type { Achievement, AchievementUserData, ChecklistItem } from './types';

const MARKER = /^\s*(?:[-*•·–—]|\[[ xX]?\]|☐|☑|✓|✔|\d+\s*[.)\-:])\s*/;

/** Text pasted from a guide, one item per line, becomes checklist items. */
export function parseChecklist(
  text: string,
  existing: ChecklistItem[] = [],
): ChecklistItem[] {
  const seen = new Set(existing.map((i) => i.text.toLowerCase()));
  const items: ChecklistItem[] = [];
  for (const line of text.split(/\r?\n/)) {
    // Repeat for cases like "- [ ] 1. Item".
    let clean = line;
    for (let prev = ''; prev !== clean;) {
      prev = clean;
      clean = clean.replace(MARKER, '');
    }
    clean = clean.trim();
    const key = clean.toLowerCase();
    if (clean === '' || seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: `${Date.now().toString(36)}-${existing.length + items.length}`,
      text: clean,
      done: false,
    });
  }
  return items;
}

export interface ShownProgress {
  current: number;
  target: number;
  source: 'steam' | 'checklist';
}

/** The Steam counter wins; without it, the user's checklist plays the role of the counter. */
export function shownProgress(
  a: Achievement,
  data: AchievementUserData | undefined,
): ShownProgress | null {
  if (a.progress) return { ...a.progress, source: 'steam' };
  const list = data?.checklist ?? [];
  if (list.length === 0) return null;
  return {
    current: list.filter((i) => i.done).length,
    target: list.length,
    source: 'checklist',
  };
}
