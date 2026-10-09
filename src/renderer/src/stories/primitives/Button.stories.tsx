import { type Meta, type StoryObj } from '@storybook/react-vite';
import { Download } from 'lucide-react';
import { fn } from 'storybook/test';

import { Button } from '@ui/primitives/button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  // Documented by hand in Button.mdx.
  tags: ['!autodocs'],
  args: {
    children: 'Verify',
    onClick: fn(),
  },
  argTypes: {
    variant: {
      options: [
        'default',
        'secondary',
        'outline',
        'ghost',
        'destructive',
        'link',
      ],
      control: 'select',
      table: {
        category: 'Appearance',
        type: {
          summary: 'enum (string)',
          detail:
            "'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'",
        },
        defaultValue: { summary: 'default' },
      },
    },
    size: {
      options: [
        'default',
        'sm',
        'xs',
        'lg',
        'icon',
        'icon-sm',
        'icon-xs',
        'icon-lg',
      ],
      control: 'select',
      table: {
        category: 'Appearance',
        type: { summary: 'enum (string)' },
        defaultValue: { summary: 'default' },
      },
    },
    disabled: {
      control: 'boolean',
      table: { type: { summary: 'boolean' } },
    },
    asChild: {
      name: 'asChild (renders the child as the actual button)',
      table: { type: { summary: 'boolean' } },
    },
    onClick: { table: { category: 'Event Listeners' } },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: { children: 'Replace key', variant: 'secondary' },
};

export const Outline: Story = {
  args: { children: 'Add another account', variant: 'outline' },
};

export const Ghost: Story = {
  args: { children: 'Cancel', variant: 'ghost' },
};

export const Destructive: Story = {
  args: { children: 'Remove account', variant: 'destructive' },
};

export const Link: Story = {
  args: { children: 'Use another account', variant: 'link' },
};

export const Small: Story = {
  args: { children: 'Check for updates', variant: 'secondary', size: 'sm' },
};

export const WithIcon: Story = {
  args: { size: 'sm' },
  render: (props) => (
    <Button {...props}>
      <Download />
      Download
    </Button>
  ),
};

export const Disabled: Story = {
  args: { children: 'Verifying…', disabled: true },
};
