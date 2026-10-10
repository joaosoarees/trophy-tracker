import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { makeGameSummary } from '@tests/factories/makeGameSummary';
import { GameRow } from '@ui/screens/Dashboard/components/GameRow';

const game = makeGameSummary({
  appid: 3681010,
  name: 'Nioh 3',
  capsule:
    'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3681010/19b0758706fefb5c06a6183365fd62dafe2bf914/capsule_231x87.jpg',
  total: 64,
  unlocked: 20,
});

const meta = {
  title: 'Screens/Dashboard/GameRow',
  component: GameRow,
  args: { game, onPick: fn() },
  argTypes: { onPick: { table: { category: 'Event Listeners' } } },
  parameters: {
    docs: {
      description: {
        component:
          'A played game in the dashboard: one card that is clicked as a whole and opens the game. In progress it shows a bar and what is left; complete, a green check with the date it was finished, since a full bar would say nothing new. The art sits in a fixed box, so rows keep their height while it loads.',
      },
    },
  },
  decorators: [
    (Story) => (
      <ul className="flex flex-col gap-1.5">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof GameRow>;
export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const Complete: Story = {
  args: {
    game: { ...game, unlocked: 64, completedAt: 1_789_900_000 },
  },
};

/** A game the store has no art for: the fallback keeps the box. */
export const WithoutArt: Story = {
  args: { game: { ...game, capsule: '', name: 'A Game With No Art' } },
};

export const LongName: Story = {
  args: {
    game: {
      ...game,
      name: 'The Legend of an Extremely Long Subtitle: Definitive Remastered Anniversary Edition',
    },
  },
};
