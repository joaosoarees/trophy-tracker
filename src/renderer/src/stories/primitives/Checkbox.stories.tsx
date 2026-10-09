import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Checkbox } from '@ui/primitives/checkbox';
import { Label } from '@ui/primitives/label';

const meta = {
  title: 'Primitives/Checkbox',
  component: Checkbox,
  args: {
    'aria-label': 'Kodama found in the first region',
    onCheckedChange: fn(),
  },
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onCheckedChange: { table: { category: 'Event Listeners' } },
  },
} satisfies Meta<typeof Checkbox>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const Disabled: Story = { args: { disabled: true } };

/** In a checklist the item's text is the checkbox's label: clicking the text checks it. */
export const WithLabel: Story = {
  render: (props) => (
    <div className="flex items-center gap-2">
      <Checkbox id="story-item" {...props} aria-label={undefined} />
      <Label htmlFor="story-item">Kodama found in the first region</Label>
    </div>
  ),
};
