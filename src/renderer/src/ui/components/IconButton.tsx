import { type ComponentProps } from 'react';

import { Button } from '@ui/primitives/button';

import { Hint } from './Hint';

interface IIconButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'aria-label' | 'title'
> {
  /** Name of the action: read by screen readers and shown as the tooltip. */
  label: string;
}

/** A button with only an icon. The label is mandatory because the icon alone says nothing. */
export function IconButton({
  label,
  size = 'icon-sm',
  variant = 'ghost',
  ...props
}: IIconButtonProps) {
  return (
    <Hint label={label}>
      <Button aria-label={label} size={size} variant={variant} {...props} />
    </Hint>
  );
}
