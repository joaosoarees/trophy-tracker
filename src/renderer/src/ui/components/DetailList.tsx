import { type ReactNode, useId } from 'react';

import { cn } from '@ui/utils/cn';

import { Pressable } from './Pressable';

interface IDetailGroupProps {
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * A titled group of rows. Hairlines sit only between its rows: the title
 * opens the group and the space after it closes it, so no line is drawn
 * above the first row or below the last.
 *
 * The group is 8px wider than its text on each side, and every row is inset
 * by the same 8px. That makes a row's hover wash exactly as wide as the
 * hairlines around it, with the text still on the page's margin.
 */
export function DetailGroup({ title, children, className }: IDetailGroupProps) {
  const id = useId();

  return (
    <section aria-labelledby={id} className={cn('-mx-2', className)}>
      <h2 id={id} className="px-2 pb-1 font-semibold">
        {title}
      </h2>
      <ul className="divide-y">{children}</ul>
    </section>
  );
}

interface IDetailRowProps {
  label: ReactNode;
  /** A line under the label saying what the row does or means. */
  description?: ReactNode;
  /** The value, or the control that changes it, at the end of the row. */
  children?: ReactNode;
  /** Makes the whole row one clickable target. */
  onClick?: () => void;
}

/** One fact or one setting: what it is on the left, its value or control on the right. */
export function DetailRow({
  label,
  description,
  children,
  onClick,
}: IDetailRowProps) {
  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{label}</span>
        {description && (
          <small className="text-muted-foreground text-xs">{description}</small>
        )}
      </span>
      {children && (
        <span className="text-muted-foreground flex flex-none items-center gap-2 text-right tabular-nums">
          {children}
        </span>
      )}
    </>
  );

  return (
    <li>
      {onClick ? (
        <Pressable
          onClick={onClick}
          className="hover:bg-accent/40 active:bg-accent/70 flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left active:scale-[0.99]"
        >
          {content}
        </Pressable>
      ) : (
        <div className="flex items-center gap-3 px-2 py-2.5">{content}</div>
      )}
    </li>
  );
}
