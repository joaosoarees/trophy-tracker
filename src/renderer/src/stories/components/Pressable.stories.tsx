import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Pressable } from '@ui/components/Pressable';

const meta = {
  title: 'Components/Pressable',
  component: Pressable,
  args: {
    onClick: fn(),
    children: 'A row that can be clicked',
    className:
      'bg-card hover:border-input hover:bg-accent/40 active:bg-accent/70 w-full rounded-lg border p-3 text-left active:scale-[0.99]',
  },
  argTypes: {
    disabled: { control: 'boolean' },
    onClick: { table: { category: 'Event Listeners' } },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The base of every hand-made clickable element (tabs, rows, cards): a button with the keyboard focus ring and the disabled state built in. Each use adds its own look and hover through `className`. A raw `<button>` is forbidden by lint outside this file and the primitives, so nothing clickable ships without a focus ring. Wide targets tone the press down to 99 percent.',
      },
    },
  },
} satisfies Meta<typeof Pressable>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };
