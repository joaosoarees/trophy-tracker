import { cn } from '@ui/utils/cn';

interface INativeSelectProps<T extends string> {
  /** Accessible name; the options alone do not say what is being chosen. */
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function NativeSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: INativeSelectProps<T>) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(
        'bg-muted text-foreground hover:bg-accent focus-visible:ring-ring h-8 rounded-md border px-2 text-xs transition-colors outline-none focus-visible:ring-2',
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
