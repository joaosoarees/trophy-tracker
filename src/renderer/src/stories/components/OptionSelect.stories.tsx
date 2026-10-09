import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { OptionSelect } from '@ui/components/OptionSelect';

const options = [
  { value: 'common', label: 'Most common first' },
  { value: 'rare', label: 'Rarest first' },
  { value: 'name', label: 'By name' },
];

const meta = {
  title: 'Components/OptionSelect',
  component: OptionSelect,
  args: {
    label: 'Sort by',
    value: 'common',
    options,
    onChange: fn(),
    className: 'w-56',
  },
  argTypes: {
    label: { table: { category: 'Accessibility' } },
    onChange: { table: { category: 'Event Listeners' } },
  },
  parameters: {
    docs: {
      description: {
        component:
          'A compact field (32px, 12px text) in Recessed Slate with a chevron. Its list is drawn inside the page, on Panel Navy with the Popover shadow, never by the operating system: a native select opens a system popup that cannot be themed. `label` is mandatory, because the options alone do not say what is being chosen.',
      },
    },
  },
} satisfies Meta<typeof OptionSelect>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(props) {
    const [value, setValue] = useState(props.value);

    return <OptionSelect {...props} value={value} onChange={setValue} />;
  },
};
