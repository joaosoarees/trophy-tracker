import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { Switch } from '@ui/components/Switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  args: {
    label: 'Keep the window on top',
    checked: false,
    onChange: fn(),
  },
  argTypes: {
    onChange: { table: { category: 'Event Listeners' } },
  },
  parameters: {
    docs: {
      description: {
        component:
          'An on/off setting that takes effect at once: a fully round 36 by 20px track, Field Edge when off and Signal Blue when on. Its row carries the visible label; the switch carries the same words for assistive technology, which is why `label` is mandatory. For a choice that needs a "Save", use something else.',
      },
    },
  },
} satisfies Meta<typeof Switch>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = { args: { checked: true } };

/** It answers at once. */
export const Live: Story = {
  render: function Render(props) {
    const [isOn, setIsOn] = useState(false);

    return <Switch {...props} checked={isOn} onChange={setIsOn} />;
  },
};
