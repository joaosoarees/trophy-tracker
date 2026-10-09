import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Textarea } from '@ui/primitives/textarea';

const meta = {
  title: 'Primitives/Textarea',
  component: Textarea,
  args: {
    'aria-label': 'Note',
    placeholder: 'Your note or a guide link',
  },
} satisfies Meta<typeof Textarea>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithText: Story = {
  args: {
    defaultValue:
      'Third region, behind the waterfall. Needs the double jump from chapter 4.',
  },
};
