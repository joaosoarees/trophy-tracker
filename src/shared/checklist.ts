import { type IAchievement } from './types/Achievement';
import {
  type IAchievementUserData,
  type IChecklistItem,
} from './types/UserData';

const MARKER = /^\s*(?:[-*•·–—]|\[[ xX]?\]|☐|☑|✓|✔|\d+\s*[.)\-:])\s*/;

/** Text pasted from a guide, one item per line, becomes checklist items. */
export function parseChecklist(
  text: string,
  existing: IChecklistItem[] = [],
): IChecklistItem[] {
  const seen = new Set(existing.map((i) => i.text.toLowerCase()));
  const items: IChecklistItem[] = [];
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

export interface IShownProgress {
  current: number;
  target: number;
  source: 'steam' | 'checklist';
}

/** The Steam counter wins; without it, the user's checklist plays the role of the counter. */
export function shownProgress(
  a: IAchievement,
  data: IAchievementUserData | undefined,
): IShownProgress | null {
  if (a.progress) return { ...a.progress, source: 'steam' };
  const list = data?.checklist ?? [];
  if (list.length === 0) return null;
  return {
    current: list.filter((i) => i.done).length,
    target: list.length,
    source: 'checklist',
  };
}

/**
 * A hand-typed item goes in exactly as written (no bullet clean-up).
 * Returns `'blank'` or `'duplicate'` when there is nothing to add.
 */
export function createChecklistItem(
  text: string,
  existing: IChecklistItem[],
): IChecklistItem | 'blank' | 'duplicate' {
  const clean = text.trim();
  if (clean === '') return 'blank';
  if (isOnChecklist(clean, existing)) return 'duplicate';

  return {
    id: `${Date.now().toString(36)}-${existing.length}`,
    text: clean,
    done: false,
  };
}

/** A list holds a text once, whatever its case and the spaces around it. */
export function isOnChecklist(text: string, items: IChecklistItem[]): boolean {
  const key = text.trim().toLowerCase();
  return items.some((item) => item.text.toLowerCase() === key);
}

/**
 * A removed item goes back into the list as it is now, not as it was when the
 * item left: at the place it was taken from, or at the end when the list got
 * shorter than that. Answers the list it was given when the item is already on
 * it, or its text is, typed again meanwhile.
 */
export function restoreChecklistItem(
  items: IChecklistItem[],
  removed: IChecklistItem,
  index: number,
): IChecklistItem[] {
  const isBack =
    items.some((item) => item.id === removed.id) ||
    isOnChecklist(removed.text, items);
  if (isBack) return items;

  return [...items.slice(0, index), removed, ...items.slice(index)];
}
