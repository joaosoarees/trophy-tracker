import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { SearchBox } from '@ui/components/SearchBox';

const meta = {
  title: 'Components/SearchBox',
  component: SearchBox,
  args: {
    value: '',
    placeholder: 'Search achievements by name or description',
    onChange: fn(),
  },
  argTypes: { onChange: { table: { category: 'Event Listeners' } } },
  parameters: {
    docs: {
      description: {
        component:
          'A 32px field with a magnifier on the left and, once there is text, a button on the right that clears it. The search it feeds ignores accents and case.',
      },
    },
  },
} satisfies Meta<typeof SearchBox>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/** With text, the clear button appears. */
export const Live: Story = {
  render: function Render(props) {
    const [value, setValue] = useState('kodama');

    return <SearchBox {...props} value={value} onChange={setValue} />;
  },
};
