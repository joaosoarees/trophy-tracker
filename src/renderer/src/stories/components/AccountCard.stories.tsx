import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { type IAccount } from '@shared/types/Account';
import { AccountCard, AddAccountCard } from '@ui/components/AccountCard';
import { MaskedKey } from '@ui/components/MaskedKey';
import { Button } from '@ui/primitives/button';

const account: IAccount = {
  steamId: '76561198000000042',
  name: 'Audit Hunter',
  avatar: '',
  keyEnding: 'CDEF',
  isKeyEncrypted: true,
  status: 'valid',
  checkedAt: 1_790_000_000_000,
};

const second: IAccount = {
  ...account,
  steamId: '76561198000000043',
  name: 'Second Hunter',
  keyEnding: '0000',
};

const meta = {
  title: 'Components/AccountCard',
  component: AccountCard,
  // Documented by hand in AccountCard.mdx.
  tags: ['!autodocs'],
  args: { account },
  argTypes: {
    isActive: { control: 'boolean', table: { category: 'State' } },
    onSelect: { table: { category: 'Event Listeners' } },
    status: { control: false, table: { category: 'Slots' } },
    action: { control: false, table: { category: 'Slots' } },
    children: { control: false, table: { category: 'Slots' } },
  },
  // A card is always an item of a list.
  decorators: [
    (Story) => (
      <ul className="flex flex-col gap-2">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof AccountCard>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Another account: the whole card is one button that switches to it. */
export const Switchable: Story = { args: { onSelect: fn() } };

/** The account in use opens inside its card, on the field colour. */
export const InUse: Story = {
  args: { isActive: true, onSelect: fn() },
  render: (props) => (
    <AccountCard {...props}>
      <div className="bg-background flex flex-col gap-2 rounded-b-[7px] border-t px-3 py-2.5">
        <p className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs">Web API key</span>
          <MaskedKey ending={props.account.keyEnding} />
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary">
            Replace key
          </Button>
          <Button size="sm" variant="destructive">
            Remove account
          </Button>
        </div>
      </div>
    </AccountCard>
  ),
};

/** Steam refused the key: the icon turns red, the words stay readable. */
export const KeyRefused: Story = {
  args: { account: { ...account, status: 'rejected' }, isActive: true },
};

/** A name too long for the card is cut; the SteamID still tells the account apart. */
export const LongName: Story = {
  args: {
    account: {
      ...account,
      name: 'The Completionist Formerly Known As Hunter Of Every Last Kodama',
    },
    onSelect: fn(),
  },
};

/** As Settings lists them: the one in use, the others, and the card that adds. */
export const InAList: Story = {
  render: () => (
    <>
      <AccountCard account={account} isActive onSelect={fn()} />
      <AccountCard account={second} onSelect={fn()} />
      <AddAccountCard onAdd={fn()} />
    </>
  ),
};
