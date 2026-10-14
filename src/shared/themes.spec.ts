import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_THEME,
  type IThemeColors,
  isThemeId,
  THEME_IDS,
  THEMES,
} from './themes';

type ColorName = keyof IThemeColors;

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

/** Relative luminance, as WCAG 2 defines it. */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** The hue of a colour, in degrees. */
function hue(hex: string): number {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);
  const sixth =
    max === r
      ? ((g - b) / span) % 6
      : max === g
        ? (b - r) / span + 2
        : (r - g) / span + 4;
  return (sixth * 60 + 360) % 360;
}

/** The three families a colour that means something stays in. */
const FAMILIES = {
  red: (h: number) => h >= 345 || h < 20,
  amber: (h: number) => h >= 20 && h < 65,
  green: (h: number) => h >= 65 && h < 170,
};

/** Text and the surfaces it is written on: 4.5 to 1, WCAG AA for body text. */
const TEXT_ON: [ColorName, ColorName[]][] = [
  ['foreground', ['background', 'card', 'muted', 'secondary']],
  ['card-foreground', ['card']],
  ['popover-foreground', ['popover']],
  ['secondary-foreground', ['secondary']],
  ['accent-foreground', ['accent']],
  ['muted-foreground', ['background', 'card', 'muted']],
  ['primary-foreground', ['primary']],
  ['primary', ['background', 'card']],
  ['destructive', ['background', 'card']],
  ['success', ['background', 'card']],
  ['warning', ['background', 'card']],
];

describe('themes', () => {
  describe.each(THEME_IDS)('%s', (id) => {
    const { colors } = THEMES[id];

    it.each(
      TEXT_ON.flatMap(([text, surfaces]) =>
        surfaces.map((surface) => ({ text, surface })),
      ),
    )('should keep $text readable on $surface', ({ text, surface }) => {
      const ratio = contrast(colors[text], colors[surface]);

      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should keep the focus ring visible on the window', () => {
      const ratio = contrast(colors.ring, colors.background);

      expect(ratio).toBeGreaterThanOrEqual(3);
    });

    it.each([
      { meaning: 'done', color: 'success', family: 'green' },
      { meaning: 'set apart', color: 'warning', family: 'amber' },
      { meaning: 'loss', color: 'destructive', family: 'red' },
    ] as const)('should keep $meaning a $family', ({ color, family }) => {
      const isInFamily = FAMILIES[family](hue(colors[color]));

      expect(isInFamily).toBe(true);
    });

    it('should keep the accent out of the three families that mean something', () => {
      const accent = hue(colors.primary);

      const families = Object.entries(FAMILIES)
        .filter(([, has]) => has(accent))
        .map(([name]) => name);

      expect(families).toEqual([]);
    });

    it('should write every colour as six hexadecimal digits', () => {
      const badlyWritten = Object.entries(colors).filter(
        ([, value]) => !/^#[0-9a-f]{6}$/.test(value),
      );

      expect(badlyWritten).toEqual([]);
    });
  });

  it('should have in the stylesheet the colours of the theme a new install starts on', () => {
    const css = readFileSync(
      join(__dirname, '../renderer/src/ui/styles/index.css'),
      'utf8',
    );
    const root = /:root \{([^}]*)\}/.exec(css)?.[1] ?? '';

    const written = Object.fromEntries(
      [...root.matchAll(/--([a-z-]+): (#[0-9a-f]{6});/g)].map(
        ([, name, value]) => [name, value],
      ),
    );

    expect(written).toEqual(THEMES[DEFAULT_THEME].colors);
  });

  describe('isThemeId', () => {
    it('should take the name of a theme', () => {
      const isOne = isThemeId('dracula');

      expect(isOne).toBe(true);
    });

    it.each([
      { kind: 'a name no theme has', value: 'solarized' },
      { kind: 'a property every object has', value: 'toString' },
      { kind: 'something that is not text', value: 3 },
      { kind: 'nothing', value: undefined },
    ])('should refuse $kind', ({ value }) => {
      const isOne = isThemeId(value);

      expect(isOne).toBe(false);
    });
  });
});
