import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Hint } from '@ui/components/Hint';
import { Button } from '@ui/primitives/button';

const meta = {
  title: 'Components/Hint',
  component: Hint,
  args: {
    label: 'Only achievements Steam hides until they are unlocked',
    children: <Button variant="ghost">Hidden 17</Button>,
  },
  argTypes: {
    side: {
      options: ['top', 'right', 'bottom', 'left'],
      control: 'inline-radio',
    },
    children: { control: false },
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Explains a control on hover and on keyboard focus. Used instead of the native `title`, which is slow and never shows on focus. An icon-only button does not need it: `IconButton` brings its own.',
      },
    },
  },
} satisfies Meta<typeof Hint>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Above: Story = { args: { side: 'top' } };
