import { type Meta, type StoryObj } from '@storybook/react-vite';
import { Gamepad2, User } from 'lucide-react';

import { RemoteImage } from '@ui/components/RemoteImage';

const meta = {
  title: 'Components/RemoteImage',
  component: RemoteImage,
  args: {
    src: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3681010/19b0758706fefb5c06a6183365fd62dafe2bf914/capsule_231x87.jpg',
    fallback: <Gamepad2 className="size-5" />,
    className: 'h-[42px] w-28 rounded',
  },
  argTypes: { fallback: { control: false } },
  parameters: {
    docs: {
      description: {
        component:
          'An image from the network in a fixed box: a skeleton while it loads, the fallback if it fails. Every network image goes through it, never a bare `<img>`, so rows keep their height while images load and one image that fails or lags never affects the others.',
      },
    },
  },
} satisfies Meta<typeof RemoteImage>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Needs the internet: the picture comes from Steam. */
export const Loaded: Story = {};

/** An address that answers with an error: the fallback takes the box. */
export const Failed: Story = {
  args: { src: 'https://shared.fastly.steamstatic.com/nothing-here.jpg' },
};

/** With no address at all, as an account whose avatar is unknown. */
export const NoSource: Story = {
  args: {
    src: '',
    fallback: <User className="size-5" />,
    className: 'size-10',
  },
};
