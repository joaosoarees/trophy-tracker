import { SystemService } from '@app/services/SystemService';
import { DEFAULT_THEME, isThemeId, type ThemeId, THEMES } from '@shared/themes';

import { safeSessionStorageGetItem } from './safeSessionStorageGetItem';

const STORAGE_KEY = 'theme';

/**
 * The theme to draw before the main process has answered anything: the one
 * this window was last drawn in (a reload, for a change of language, keeps
 * the address the window was opened with), or else the one the main process
 * put in the address as it opened the window.
 */
export function firstTheme(search: string, lastShown: unknown): ThemeId {
  if (isThemeId(lastShown)) return lastShown;
  const opened = new URLSearchParams(search).get('theme');
  return isThemeId(opened) ? opened : DEFAULT_THEME;
}

/** The theme this window was last drawn in, if it was drawn before. */
export const lastShownTheme = (): unknown =>
  safeSessionStorageGetItem<unknown>(STORAGE_KEY);

/**
 * Draws the interface in a theme: its colours fill the variables the styles
 * read, and what the system draws (scrollbars, the window's field and
 * buttons) follows.
 */
export function showTheme(theme: ThemeId): void {
  const { colors, scheme } = THEMES[theme];
  const root = document.documentElement;
  for (const [name, value] of Object.entries(colors)) {
    root.style.setProperty(`--${name}`, value);
  }
  root.style.colorScheme = scheme;
  root.classList.toggle('dark', scheme === 'dark');
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // Only the first frame after a reload would be in the theme of the address.
  }
  SystemService.paintWindow(theme);
}
