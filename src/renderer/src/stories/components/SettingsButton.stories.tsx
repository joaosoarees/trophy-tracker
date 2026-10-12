import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { type IAccount } from '@shared/types/Account';
import { SettingsButton } from '@ui/components/AppShell/SettingsButton';

const account: IAccount = {
  steamId: '76561198000000042',
  name: 'Audit Hunter',
  avatar: '',
  keyEnding: 'CDEF',
  isKeyEncrypted: true,
  status: 'valid',
};

const meta = {
  title: 'Components/SettingsButton',
  component: SettingsButton,
  args: { isCurrent: false, account: null, onClick: fn() },
  argTypes: {
    isCurrent: { control: 'boolean', table: { category: 'State' } },
    account: { control: false, table: { category: 'State' } },
    onClick: { table: { category: 'Event Listeners' } },
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The last button of the tab bar, which leads to Settings. With one account it is a gear. With more than one it carries the 24px face of the account in use, and its tooltip names it: the bar has no room for one more button at 480px.',
      },
    },
  },
} satisfies Meta<typeof SettingsButton>;
export default meta;

type Story = StoryObj<typeof meta>;

/** One account: there is nothing to tell apart. */
export const Gear: Story = {};

export const GearOnSettings: Story = { args: { isCurrent: true } };

/** More than one account. The face here failed to load, so the fallback shows. */
export const AccountInUse: Story = { args: { account } };

/** Settings is on screen: the ring stands for the accent the gear takes. */
export const AccountInUseOnSettings: Story = {
  args: { account, isCurrent: true },
};
