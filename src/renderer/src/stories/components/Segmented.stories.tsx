import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { Segmented } from '@ui/components/Segmented';

const meta = {
  title: 'Components/Segmented',
  component: Segmented,
  args: {
    label: 'Which achievements to list',
    value: 'pending',
    options: [
      { value: 'pending', label: 'Pending 44' },
      { value: 'unlocked', label: 'Unlocked 20' },
    ],
    onChange: fn(),
  },
  argTypes: {
    label: { table: { category: 'Accessibility' } },
    onChange: { table: { category: 'Event Listeners' } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Two or three options in a Recessed Slate well with 2px of padding. The selected option is a chip of Hover Steel with Lit White text, told apart by tone alone; the others are Quiet Steel and take a wash on hover. Each option carries its count. The selected option is announced with `aria-pressed`. It never takes the primary button's solid fill: a state must not outshine the one action that moves the user forward.",
      },
    },
  },
} satisfies Meta<typeof Segmented>;
export default meta;

type Story = StoryObj<typeof meta>;

export const TwoOptions: Story = {
  render: function Render(props) {
    const [value, setValue] = useState(props.value);

    return <Segmented {...props} value={value} onChange={setValue} />;
  },
};
