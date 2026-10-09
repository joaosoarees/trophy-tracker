import { type Meta, type StoryObj } from '@storybook/react-vite';

import { KeyField } from '@ui/components/KeyField';

const meta = {
  title: 'Components/KeyField',
  component: KeyField,
  args: {
    'aria-label': 'Web API key',
    placeholder: 'Paste the key here',
  },
  argTypes: {
    readOnly: { control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Where a Web API key is typed or pasted: hidden like a password, in the monospaced face so 32 characters can be checked by eye once shown. Only a key being typed can be shown; it never starts filled with a saved one. The monospaced face exists for this field and `MaskedKey` alone.',
      },
    },
  },
} satisfies Meta<typeof KeyField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/** Hidden until the eye is pressed. */
export const Filled: Story = {
  args: { defaultValue: '0123456789ABCDEF0123456789ABCDEF' },
};

export const Invalid: Story = {
  args: { defaultValue: 'not-a-key', 'aria-invalid': true },
};

/** Once verified: recessed, with nothing to toggle. */
export const ReadOnly: Story = {
  args: { defaultValue: '0123456789ABCDEF0123456789ABCDEF', readOnly: true },
};
