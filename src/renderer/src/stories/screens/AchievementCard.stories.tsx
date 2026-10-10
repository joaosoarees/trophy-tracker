import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { makeAchievement } from '@tests/factories/makeAchievement';
import { AchievementCard } from '@ui/screens/Game/components/AchievementCard';

const ICONS =
  'https://shared.fastly.steamstatic.com/community_assets/images/apps/3681010';

const achievement = makeAchievement({
  id: 'ACH_010',
  name: 'First Purification',
  description: 'Purify a Soul Core for the first time.',
  rarity: 87.1,
  icon: `${ICONS}/missing.jpg`,
  iconGray: `${ICONS}/missing.jpg`,
});

const meta = {
  title: 'Screens/Game/AchievementCard',
  component: AchievementCard,
  // Documented by hand in AchievementCard.mdx.
  tags: ['!autodocs'],
  args: {
    achievement,
    game: 'Nioh 3',
    appid: 3681010,
    data: undefined,
    onChange: fn(),
  },
  argTypes: {
    achievement: { table: { category: 'From Steam' } },
    game: { table: { category: 'From Steam' } },
    appid: { table: { category: 'From Steam' } },
    data: { table: { category: 'Written by the user' } },
    onChange: { table: { category: 'Event Listeners' } },
  },
  decorators: [
    (Story) => (
      <ul className="flex flex-col gap-2">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof AchievementCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Pending: Story = {};

/** Steam hides it until it is unlocked; the app shows it, marked in amber. */
export const Hidden: Story = {
  args: {
    achievement: {
      ...achievement,
      name: 'You Are Nioh',
      description: 'Defeat the final boss.',
      hidden: true,
      rarity: 4.2,
    },
  },
};

/** A counter Steam reports: the bar and its number, never an invented value. */
export const WithCounter: Story = {
  args: {
    achievement: {
      ...achievement,
      name: 'Kodama Leader',
      description: 'Find 150 Kodama.',
      rarity: 12.5,
      progress: { current: 57, target: 150 },
    },
  },
};

export const Unlocked: Story = {
  args: {
    achievement: {
      ...achievement,
      unlocked: true,
      unlockedAt: 1_786_000_000,
    },
  },
};

/** The user's own mark: an amber border and a filled pin. */
export const Pinned: Story = {
  args: { data: { note: '', pinned: true } },
};

/** A note that has text stays open. */
export const WithANote: Story = {
  args: {
    data: {
      note: 'Third region, behind the waterfall. Needs the double jump.',
      pinned: false,
    },
  },
};

/** A checklist with items left to check starts open: which ones are left is what it is for. */
export const WithAChecklist: Story = {
  args: {
    achievement: {
      ...achievement,
      name: 'Kodama Leader',
      description: 'Find 150 Kodama.',
      rarity: 12.5,
    },
    data: {
      note: '',
      pinned: false,
      checklist: [
        { id: '1', text: 'First region', done: true },
        { id: '2', text: 'Second region', done: true },
        { id: '3', text: 'Third region', done: false },
        { id: '4', text: 'Fourth region', done: false },
      ],
    },
  },
};
