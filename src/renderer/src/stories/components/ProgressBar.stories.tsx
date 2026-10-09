import { type Meta, type StoryObj } from '@storybook/react-vite';

import { ProgressBar } from '@ui/components/ProgressBar';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  args: { label: 'Nioh 3', value: 31 },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
    tone: {
      options: ['primary', 'success'],
      control: 'inline-radio',
      table: { category: 'Appearance', defaultValue: { summary: 'primary' } },
    },
    label: { table: { category: 'Accessibility' } },
  },
  parameters: {
    docs: {
      description: {
        component:
          'A fully round track of Control Slate, 6px tall (8px in a header), filled with Signal Blue, or Unlocked Green when it stands for something finished. Its number sits beside it in tabular caption text, never inside it, so the bar itself has no text and `label` names it for assistive technology.',
      },
    },
  },
} satisfies Meta<typeof ProgressBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

/** Green is "done", and only that. */
export const Finished: Story = { args: { value: 100, tone: 'success' } };

export const InAHeader: Story = { args: { className: 'h-2' } };

/** With its number beside it, in tabular figures so it does not shift as it changes. */
export const WithItsNumber: Story = {
  render: (props) => (
    <div className="flex items-center gap-3">
      <ProgressBar {...props} className="flex-1" />
      <small className="text-muted-foreground text-xs tabular-nums">
        20/64
      </small>
    </div>
  ),
};
