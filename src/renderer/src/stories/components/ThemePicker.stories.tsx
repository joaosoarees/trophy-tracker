import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { ThemePicker } from '@ui/components/ThemePicker';

const meta = {
  title: 'Components/ThemePicker',
  component: ThemePicker,
  args: {
    label: 'Theme',
    value: 'navy',
    onChange: fn(),
  },
  argTypes: {
    label: { table: { category: 'Accessibility' } },
    value: { table: { category: 'State' } },
    onChange: { table: { category: 'Event Listeners' } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "One button per theme, each with a sample of that theme's own field, accent and text, so a theme is seen before it is picked. The sample keeps its colours whichever theme is on screen; the button around it is drawn in the theme on screen, and the picked one has the accent border and is announced with `aria-pressed`. The names are the palettes' own and are not translated. The row wraps.",
      },
    },
  },
} satisfies Meta<typeof ThemePicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(props) {
    const [value, setValue] = useState(props.value);

    return <ThemePicker {...props} value={value} onChange={setValue} />;
  },
};

/** Another theme picked: the accent border moves, the samples stay as they are. */
export const AnotherPicked: Story = {
  args: { value: 'dracula' },
};
