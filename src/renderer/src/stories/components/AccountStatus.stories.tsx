import { type Meta, type StoryObj } from '@storybook/react-vite';

import { AccountStatus } from '@ui/components/AccountStatus';

const meta = {
  title: 'Components/AccountStatus',
  component: AccountStatus,
  args: { status: 'valid' },
  argTypes: {
    status: {
      options: ['valid', 'rejected', 'rateLimited'],
      control: 'inline-radio',
      table: {
        type: {
          summary: 'AccountStatus',
          detail: "'valid' | 'rejected' | 'rateLimited'",
        },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'What is known about an account\'s key, as an icon and words, never colour alone. Only a refused key takes a colour, and only on its icon: red words do not have enough contrast on a card. A working key is not "done", so it does not take the green of a finished achievement. Steam answers a revoked key and a mistyped one alike, so there is one "refused".',
      },
    },
  },
} satisfies Meta<typeof AccountStatus>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Working: Story = {};

export const Refused: Story = { args: { status: 'rejected' } };

export const Limited: Story = { args: { status: 'rateLimited' } };
