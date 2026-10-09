import { type Meta, type StoryObj } from '@storybook/react-vite';
import { Pin, RefreshCw, Settings } from 'lucide-react';
import { fn } from 'storybook/test';

import { IconButton } from '@ui/components/IconButton';

const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  args: { label: 'Refresh', onClick: fn(), children: <RefreshCw /> },
  argTypes: {
    label: { table: { category: 'Accessibility' } },
    children: { control: false },
    onClick: { table: { category: 'Event Listeners' } },
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A 32px square ghost button holding one 16px icon. `label` is mandatory: it is both the accessible name and the tooltip, shown on hover and on keyboard focus. A toggle that is on takes the colour of what it means (Signal Blue, or Pin Amber for a pin) and announces it with `aria-pressed`.',
      },
    },
  },
} satisfies Meta<typeof IconButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A toggle that is on: here, the current tab's settings gear. */
export const On: Story = {
  args: {
    label: 'Settings',
    children: <Settings />,
    'aria-pressed': true,
    className: 'text-primary hover:text-primary',
  },
};

/** The pin is the user's own mark, so it is amber, not the accent. */
export const Pinned: Story = {
  args: {
    label: 'Unpin',
    children: <Pin className="fill-current" />,
    'aria-pressed': true,
    className: 'text-warning hover:text-warning',
  },
};

export const Disabled: Story = { args: { disabled: true } };
