import { useT } from '@app/hooks/useT';
import { cn } from '@ui/utils/cn';

interface IMaskedKeyProps {
  /** The last four characters of the key: all of it the interface ever holds. */
  ending: string;
  className?: string;
}

/**
 * A saved key as it is always shown: masked, with its last characters to tell
 * it from another. Read aloud as "key ending in…", not as a row of dots.
 */
export function MaskedKey({ ending, className }: IMaskedKeyProps) {
  const t = useT();

  return (
    <span
      role="img"
      aria-label={t.accounts.keyEnding(ending)}
      className={cn('font-mono text-xs', className)}
    >
      •••• •••• {ending}
    </span>
  );
}
