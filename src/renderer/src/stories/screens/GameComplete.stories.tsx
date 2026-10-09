import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { makeAchievement } from '@test/factories/makeAchievement';
import { GameComplete } from '@ui/screens/Game/components/GameComplete';

const meta = {
  title: 'Screens/Game/GameComplete',
  component: GameComplete,
  args: {
    completion: {
      completedAt: 1_789_900_000,
      rarest: makeAchievement({ name: 'Peerless', rarity: 6.9 }),
    },
    onSeeUnlocked: fn(),
  },
  argTypes: { onSeeUnlocked: { table: { category: 'Event Listeners' } } },
  parameters: {
    docs: {
      description: {
        component:
          'What the Game screen shows in place of the pending list once nothing is pending. It is the one authored moment in the app: "100%" at 36px in Unlocked Green, the only figure above the headline size anywhere; under it a title, the completion date and the rarest achievement earned; and one primary button to the unlocked list. No filters, no card, no container, and nothing loops.',
      },
    },
  },
} satisfies Meta<typeof GameComplete>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Steam did not report when, nor how rare: only what is known is said. */
export const WithNothingElseKnown: Story = {
  args: { completion: { completedAt: null, rarest: null } },
};
