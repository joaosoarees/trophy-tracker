import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Badge } from '@ui/primitives/badge';

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  args: { children: 'hidden' },
  argTypes: {
    variant: {
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost'],
      control: 'select',
      table: { category: 'Appearance', defaultValue: { summary: 'default' } },
    },
  },
} satisfies Meta<typeof Badge>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = { args: { variant: 'outline' } };

/** As the achievement card uses it: amber, because a hidden achievement is set apart from the rest. */
export const Hidden: Story = {
  args: {
    variant: 'outline',
    className: 'border-warning/50 text-warning text-[10px]',
  },
};
