import { type Meta, type StoryObj } from '@storybook/react-vite';
import { ExternalLink } from 'lucide-react';
import { fn } from 'storybook/test';

import { DetailGroup, DetailRow } from '@ui/components/DetailList';
import { Switch } from '@ui/components/Switch';
import { Button } from '@ui/primitives/button';

const meta = {
  title: 'Components/DetailList',
  component: DetailGroup,
  subcomponents: { DetailRow },
  args: { title: 'Window and language', children: null },
  argTypes: { children: { control: false } },
  parameters: {
    docs: {
      description: {
        component:
          'The shape facts and settings take wherever they are listed: a titled group of rows, with what the row is on the left (and, when it helps, a caption under it) and its value or its control on the right. No card around the group. Hairlines sit only between rows: none above the first or below the last. A row that leads somewhere is one clickable target, exactly as wide as the hairlines around it. Use it for independent facts; things that belong to one object (an account) go in a card instead.',
      },
    },
  },
  // The group is 8px wider than its text on each side, as on a screen.
  decorators: [
    (Story) => (
      <div className="px-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DetailGroup>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A value at the end of each row. */
export const Facts: Story = {
  args: { title: 'About this game' },
  render: (props) => (
    <DetailGroup {...props}>
      <DetailRow label="Time played">40 h 7 min</DetailRow>
      <DetailRow label="Last played">Oct 08, 2026</DetailRow>
      <DetailRow label="Hidden achievements">17</DetailRow>
    </DetailGroup>
  ),
};

/** A control at the end of each row, with a caption where the label is not enough. */
export const Settings: Story = {
  render: (props) => (
    <DetailGroup {...props}>
      <DetailRow
        label="Keep the window on top"
        description="Stays above other windows, such as a game in windowed mode."
      >
        <Switch label="Keep the window on top" checked onChange={fn()} />
      </DetailRow>
      <DetailRow label="Version" description="You have the latest version.">
        0.6.0
        <Button size="sm" variant="secondary">
          Check for updates
        </Button>
      </DetailRow>
    </DetailGroup>
  ),
};

/** A row that leads somewhere is one target, with the usual wash. */
export const Clickable: Story = {
  args: { title: 'About' },
  render: (props) => (
    <DetailGroup {...props}>
      <DetailRow label="Source code" onClick={fn()}>
        <ExternalLink className="size-4" />
      </DetailRow>
      <DetailRow label="License" onClick={fn()}>
        MIT
        <ExternalLink className="size-4" />
      </DetailRow>
    </DetailGroup>
  ),
};
