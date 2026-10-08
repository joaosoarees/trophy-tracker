import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/primitives/select';
import { cn } from '@ui/utils/cn';

interface IOptionSelectProps<T extends string> {
  /** Accessible name; the options alone do not say what is being chosen. */
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Pick one of a few options. The list is drawn inside the page rather than by
 * the system: a native `<select>` opens an OS-level popup, which is slow to
 * close under WSLg and cannot be styled.
 */
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: IOptionSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger
        aria-label={label}
        size="sm"
        className={cn(
          'bg-muted hover:bg-accent h-8 gap-2 px-2.5 text-xs transition-colors',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      {/* Drops below the field instead of covering it. */}
      <SelectContent position="popper" align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
