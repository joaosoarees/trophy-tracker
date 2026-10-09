import { CircleCheck, CircleDashed, CircleX, Hourglass } from 'lucide-react';

import { useT } from '@app/hooks/useT';
import { type AccountStatus as Status } from '@shared/types/Account';
import { cn } from '@ui/utils/cn';

const ICONS = {
  valid: CircleCheck,
  rejected: CircleX,
  rateLimited: Hourglass,
  unchecked: CircleDashed,
} as const;

interface IAccountStatusProps {
  status: Status;
  className?: string;
}

/**
 * What is known about an account's key, as an icon and words. Only a refused
 * key takes a colour (red is loss), and only on its icon: red words do not
 * have enough contrast on a card. A working key is not "done", so it does not
 * take the green of a finished achievement.
 */
export function AccountStatus({ status, className }: IAccountStatusProps) {
  const t = useT();
  const Icon = ICONS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        status === 'rejected' ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      <Icon
        className={cn(
          'size-3.5 flex-none',
          status === 'rejected' && 'text-destructive',
        )}
        aria-hidden
      />
      {t.accounts.status[status]}
    </span>
  );
}
