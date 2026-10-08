import { type ComponentProps } from 'react';

import { cn } from '@ui/utils/cn';

/**
 * The base of every hand-made clickable element (tabs, rows, toggles): a
 * button with the keyboard focus ring and the disabled state built in. Each
 * use adds its own look and hover through `className`.
 *
 * A raw `<button>` is forbidden by lint outside this file and the
 * primitives, so nothing clickable ships without these.
 */
export function Pressable({
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'focus-visible:ring-ring rounded-sm transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
