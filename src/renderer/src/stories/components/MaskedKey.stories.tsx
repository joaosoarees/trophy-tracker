import { type Meta, type StoryObj } from '@storybook/react-vite';

import { MaskedKey } from '@ui/components/MaskedKey';

const meta = {
  title: 'Components/MaskedKey',
  component: MaskedKey,
  args: { ending: 'A1B2' },
  parameters: {
    docs: {
      description: {
        component:
          'A saved Web API key as it is always shown: masked, with its last four characters to tell it from another. It is read aloud as "Key ending in A1B2", not as dots. A saved key never comes back to the screen: there is no reveal and no copy, and the interface never even receives more than these four characters.',
      },
    },
  },
} satisfies Meta<typeof MaskedKey>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
