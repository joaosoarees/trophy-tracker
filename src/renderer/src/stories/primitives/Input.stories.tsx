import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Input } from '@ui/primitives/input';
import { Label } from '@ui/primitives/label';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  args: { placeholder: '7656…', 'aria-label': 'SteamID' },
  argTypes: {
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
  },
} satisfies Meta<typeof Input>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = { args: { defaultValue: '76561198000000042' } };

/** A value the user did not type, such as the SteamID found in the Steam client. */
export const ReadOnly: Story = {
  args: {
    defaultValue: '76561198000000042',
    readOnly: true,
    className: 'bg-muted',
  },
};

/** The border turns red; the message sits under the field. */
export const Invalid: Story = {
  args: { defaultValue: '12345', 'aria-invalid': true },
  render: (props) => (
    <div className="space-y-2">
      <Label htmlFor="story-steamid">SteamID</Label>
      <Input id="story-steamid" {...props} aria-label={undefined} />
      <p className="text-destructive text-xs">
        A SteamID is a 17-digit number that starts with 7656.
      </p>
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
