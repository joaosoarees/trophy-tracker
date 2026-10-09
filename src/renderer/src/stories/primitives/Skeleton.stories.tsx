import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Skeleton } from '@ui/primitives/skeleton';

const meta = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
  args: { className: 'h-15 w-full rounded-lg' },
} satisfies Meta<typeof Skeleton>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A row of the dashboard the first time it loads. Skeletons are for first loads only. */
export const Row: Story = {};

export const Line: Story = { args: { className: 'h-4 w-2/3' } };
