import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { makeAchievement } from '@tests/factories/makeAchievement';
import { makeGameView } from '@tests/factories/makeGameView';
import { GameHeader } from '@ui/screens/Game/components/GameHeader';

const achievements = Array.from({ length: 64 }, (_, index) =>
  makeAchievement({ id: `ACH_${index}`, unlocked: index < 20 }),
);

const view = makeGameView({
  appid: 3681010,
  name: 'Nioh 3',
  achievements,
  header:
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3681010/a21264e9fd476dcb2901c2432b598107d024c5a8/header.jpg',
});

const meta = {
  title: 'Screens/Game/GameHeader',
  component: GameHeader,
  args: {
    view,
    isRunning: false,
    pending: 44,
    percent: 31,
    isComplete: false,
    isLoading: false,
    error: null,
    isDetailsOpen: false,
    onRefresh: fn(),
    onToggleDetails: fn(),
  },
  argTypes: {
    isRunning: { control: 'boolean', table: { category: 'State' } },
    isComplete: { control: 'boolean', table: { category: 'State' } },
    isLoading: { control: 'boolean', table: { category: 'State' } },
    isDetailsOpen: { control: 'boolean', table: { category: 'State' } },
    error: { control: 'text', table: { category: 'State' } },
    onRefresh: { table: { category: 'Event Listeners' } },
    onToggleDetails: { table: { category: 'Event Listeners' } },
    children: { control: false },
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The game\'s art fills a band at the top (144px) at 35 percent opacity with a slight blur, under a gradient that fades to the field colour, so the title stays readable over any image. Below the title, the progress bar shares a row with what is left ("44 left"), in title weight: it is the figure the header is glanced at for, and the only one that stands out. The art needs the internet.',
      },
    },
  },
} satisfies Meta<typeof GameHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const LastPlayed: Story = {};

/** The game is open on Steam: a green dot that pulses, the one thing in the app that loops. */
export const Running: Story = { args: { isRunning: true } };

/** A refresh is on its way: the button spins and is disabled. */
export const Refreshing: Story = { args: { isLoading: true } };

/** A read failed with the game already on screen: what was read stays, with the reason. */
export const WithAnError: Story = {
  args: { error: 'Could not reach Steam. Check your connection.' },
};

/** Finished: the art comes forward and the bar turns green. */
export const Complete: Story = {
  args: {
    view: makeGameView({
      ...view,
      achievements: achievements.map((a) => ({ ...a, unlocked: true })),
    }),
    pending: 0,
    percent: 100,
    isComplete: true,
  },
};
