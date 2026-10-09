import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Empty } from '@ui/components/Empty';
import { Button } from '@ui/primitives/button';

const meta = {
  title: 'Components/Empty',
  component: Empty,
  args: { children: 'No achievements unlocked yet.' },
  argTypes: { children: { control: false } },
  parameters: {
    docs: {
      description: {
        component:
          'A centred placeholder for a screen or a list with nothing to show. It says why there is nothing and, when there is one, offers the way out. It never says "nothing" when the truth is "could not ask": a failed read shows the reason and a way to try again.',
      },
    },
  },
} satisfies Meta<typeof Empty>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Message: Story = {};

/** A search that found nothing offers the way back. */
export const WithAWayOut: Story = {
  render: () => (
    <Empty>
      No achievement matches “kodama”.
      <Button variant="secondary" size="sm">
        Clear search
      </Button>
    </Empty>
  ),
};

/** Something failed: the reason, in red, and a way to try again. */
export const Failure: Story = {
  render: () => (
    <Empty>
      <p className="text-destructive">
        Could not reach Steam. Check your connection.
      </p>
      <Button variant="secondary">Try again</Button>
    </Empty>
  ),
};
