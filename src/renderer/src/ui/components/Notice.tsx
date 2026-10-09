import { TriangleAlert } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@ui/utils/cn';

interface INoticeProps {
  /** `info` for something the user may act on; `problem` for something that stopped working. */
  tone?: 'info' | 'problem';
  title: string;
  /** One line saying what it means or what to do. */
  description?: string;
  /** The one action it offers, at its end. */
  children?: ReactNode;
  className?: string;
}

/**
 * A message that stays on the page until its cause is gone, with the action
 * that deals with it. A problem is announced at once and marked by an icon,
 * not by red text: its words stay in the text colour so they read on the tint.
 */
export function Notice({
  tone = 'info',
  title,
  description,
  children,
  className,
}: INoticeProps) {
  const isProblem = tone === 'problem';

  return (
    <div
      role={isProblem ? 'alert' : 'status'}
      className={cn(
        'flex w-full items-center gap-3 rounded-md border p-3',
        isProblem
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-primary/40 bg-primary/10',
        className,
      )}
    >
      {isProblem && (
        <TriangleAlert
          className="text-destructive size-4 flex-none"
          aria-hidden
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        {description && (
          <small className="text-muted-foreground">{description}</small>
        )}
      </div>
      {children}
    </div>
  );
}
