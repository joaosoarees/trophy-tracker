import { cn } from '@ui/utils/cn';

interface IProgressBarProps {
  /** Percentage, from 0 to 100. */
  value: number;
  tone?: 'primary' | 'success';
  className?: string;
}

export function ProgressBar({
  value,
  tone = 'primary',
  className,
}: IProgressBarProps) {
  const percent = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn(
        'bg-secondary h-1.5 overflow-hidden rounded-full',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300',
          tone === 'success' ? 'bg-success' : 'bg-primary',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
