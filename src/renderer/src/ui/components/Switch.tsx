import { cn } from '@ui/utils/cn';

import { Pressable } from './Pressable';

interface ISwitchProps {
  /** What is being turned on or off; the switch itself has no text. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off setting that takes effect at once. */
export function Switch({ label, checked, onChange }: ISwitchProps) {
  return (
    <Pressable
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-5 w-9 flex-none items-center rounded-full p-0.5',
        checked
          ? 'bg-primary hover:bg-primary/85'
          : 'bg-input hover:bg-muted-foreground/50',
      )}
    >
      <span
        className={cn(
          'size-4 rounded-full transition-transform duration-150',
          checked
            ? 'bg-primary-foreground translate-x-4'
            : 'bg-foreground translate-x-0',
        )}
      />
    </Pressable>
  );
}
