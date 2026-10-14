import { type ThemeId, THEME_IDS, THEMES } from '@shared/themes';
import { cn } from '@ui/utils/cn';

import { Pressable } from './Pressable';

interface IThemePickerProps {
  /** What is being chosen, for assistive technology. */
  label: string;
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}

/** One button per theme, each with a sample of its own colours. */
export function ThemePicker({ label, value, onChange }: IThemePickerProps) {
  return (
    // It wraps: the names are not translated, but the room they get changes.
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {THEME_IDS.map((id) => {
        const { label: name, colors } = THEMES[id];
        const isPicked = id === value;

        return (
          <Pressable
            key={id}
            aria-pressed={isPicked}
            onClick={() => onChange(id)}
            className={cn(
              'flex items-center gap-2 rounded-md border py-1.5 pr-3 pl-1.5 text-sm font-medium',
              isPicked
                ? 'border-primary text-foreground hover:bg-accent/30'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {/* The theme's own field, accent and text, whichever theme is on screen. */}
            <span
              aria-hidden
              className="flex h-6 w-10 flex-none items-center justify-center gap-1 rounded-sm border"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.input,
              }}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: colors.primary }}
              />
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: colors.foreground }}
              />
            </span>
            {name}
          </Pressable>
        );
      })}
    </div>
  );
}
