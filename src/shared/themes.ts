/**
 * The colours of a theme, by the name of the CSS variable each one fills
 * (`--background`, `--primary`…). What each is for is in `DESIGN.md`.
 */
export interface IThemeColors {
  background: string;
  foreground: string;
  card: string;
  'card-foreground': string;
  popover: string;
  'popover-foreground': string;
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  muted: string;
  'muted-foreground': string;
  accent: string;
  'accent-foreground': string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  success: string;
  warning: string;
}

interface ITheme {
  /** The name shown in the app: a palette's own name, the same in every language. */
  label: string;
  /** Whether its surfaces are dark or light, for what the system draws (scrollbars, fields). */
  scheme: 'dark' | 'light';
  colors: IThemeColors;
}

/**
 * To add a theme: register it here. `themes.spec.ts` then holds it to the
 * rules of every theme: each text readable on each surface it sits on, done
 * a green, set apart an amber, loss a red, and an accent that is none of the
 * three. Where a palette's own colour fails, the tone is adjusted.
 */
export const THEMES = {
  navy: {
    label: 'Navy',
    scheme: 'dark',
    colors: {
      background: '#171a21',
      foreground: '#dfe3e8',
      card: '#1d2530',
      'card-foreground': '#dfe3e8',
      popover: '#1d2530',
      'popover-foreground': '#dfe3e8',
      primary: '#66c0f4',
      'primary-foreground': '#0b1722',
      secondary: '#2a3544',
      'secondary-foreground': '#dfe3e8',
      muted: '#222b37',
      'muted-foreground': '#8b98a8',
      accent: '#2a3a4e',
      'accent-foreground': '#eaf5fd',
      destructive: '#ea6058',
      border: '#2b3544',
      input: '#344154',
      ring: '#66c0f4',
      success: '#a4d007',
      warning: '#e8b84a',
    },
  },
  // The Dracula palette (draculatheme.com, MIT). Its comment grey is lifted
  // for secondary text and its red for an error line on a card: both are
  // too dark there as the palette has them.
  dracula: {
    label: 'Dracula',
    scheme: 'dark',
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      card: '#303341',
      'card-foreground': '#f8f8f2',
      popover: '#303341',
      'popover-foreground': '#f8f8f2',
      primary: '#bd93f9',
      'primary-foreground': '#1e1f29',
      secondary: '#44475a',
      'secondary-foreground': '#f8f8f2',
      muted: '#343746',
      'muted-foreground': '#a9b1d1',
      accent: '#44475a',
      'accent-foreground': '#ffffff',
      destructive: '#ff6e6e',
      border: '#3d4051',
      input: '#51556b',
      ring: '#bd93f9',
      success: '#50fa7b',
      warning: '#ffb86c',
    },
  },
} as const satisfies Record<string, ITheme>;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeId = 'navy';

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && Object.hasOwn(THEMES, value);
