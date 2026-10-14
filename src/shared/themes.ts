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
  // The Gruvbox palette (Pavel Pertsev, MIT), dark. Its blue is turned a
  // little away from green, where done lives, and its red and its grey are
  // lifted to be read on a card.
  gruvbox: {
    label: 'Gruvbox',
    scheme: 'dark',
    colors: {
      background: '#282828',
      foreground: '#ebdbb2',
      card: '#32302f',
      'card-foreground': '#ebdbb2',
      popover: '#32302f',
      'popover-foreground': '#ebdbb2',
      primary: '#83a5a8',
      'primary-foreground': '#1d2021',
      secondary: '#504945',
      'secondary-foreground': '#ebdbb2',
      muted: '#3c3836',
      'muted-foreground': '#bdae93',
      accent: '#504945',
      'accent-foreground': '#fbf1c7',
      destructive: '#fc6c5b',
      border: '#45403d',
      input: '#665c54',
      ring: '#83a5a8',
      success: '#8ec07c',
      warning: '#fabd2f',
    },
  },
  // The Solarized palette (Ethan Schoonover, MIT), light: its two base
  // tones are the field and the panels. Its accents are made for a few words
  // of code, not for text on cream, so each is darkened until it reads.
  'solarized-light': {
    label: 'Solarized Light',
    scheme: 'light',
    colors: {
      background: '#eee8d5',
      foreground: '#073642',
      card: '#fdf6e3',
      'card-foreground': '#073642',
      popover: '#fdf6e3',
      'popover-foreground': '#073642',
      primary: '#1d6ba2',
      'primary-foreground': '#fdf6e3',
      secondary: '#ddd6c1',
      'secondary-foreground': '#073642',
      muted: '#e4ddc8',
      'muted-foreground': '#4f6369',
      accent: '#d6cfba',
      'accent-foreground': '#002b36',
      destructive: '#c22c29',
      border: '#d3ccb7',
      input: '#b3ac97',
      ring: '#1d6ba2',
      success: '#5e6d00',
      warning: '#816100',
    },
  },
  // No palette of anyone's: the neon of the eighties, on a purple night.
  synthwave: {
    label: 'Synthwave',
    scheme: 'dark',
    colors: {
      background: '#1a1128',
      foreground: '#f4e9ff',
      card: '#241838',
      'card-foreground': '#f4e9ff',
      popover: '#241838',
      'popover-foreground': '#f4e9ff',
      primary: '#ff6ad5',
      'primary-foreground': '#1a0a1f',
      secondary: '#34244f',
      'secondary-foreground': '#f4e9ff',
      muted: '#2a1d40',
      'muted-foreground': '#b3a1d1',
      accent: '#3d2a5c',
      'accent-foreground': '#ffffff',
      destructive: '#ff5b4f',
      border: '#362650',
      input: '#4a3570',
      ring: '#ff6ad5',
      success: '#3df5a0',
      warning: '#ffc857',
    },
  },
} as const satisfies Record<string, ITheme>;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeId = 'navy';

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && Object.hasOwn(THEMES, value);
