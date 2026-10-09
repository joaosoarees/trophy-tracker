import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Notice } from '@ui/components/Notice';
import { Button } from '@ui/primitives/button';

const meta = {
  title: 'Components/Notice',
  component: Notice,
  // Documented by hand in Notice.mdx.
  tags: ['!autodocs'],
  args: {
    title: 'Version 0.7.0 is available',
    description: 'Download it and install over this one. Your data is kept.',
  },
  argTypes: {
    tone: {
      options: ['info', 'problem'],
      control: 'inline-radio',
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'info' },
      },
    },
    children: { control: false, table: { category: 'Slots' } },
  },
} satisfies Meta<typeof Notice>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Information: Story = {
  render: (props) => (
    <Notice {...props}>
      <Button size="sm">Download</Button>
    </Notice>
  ),
};

export const Problem: Story = {
  args: {
    tone: 'problem',
    title: 'Steam refused the key of Audit Hunter.',
    description:
      'What was already read stays on screen. Replace the key to keep it up to date.',
  },
  render: (props) => (
    <Notice {...props}>
      <Button size="sm" variant="secondary">
        Replace key
      </Button>
    </Notice>
  ),
};

/** Nothing to do about it: it only says what is happening. */
export const WithoutAction: Story = {
  args: {
    title: 'Steam is limiting the key of Audit Hunter.',
    description: 'Reading resumes by itself once Steam accepts it again.',
  },
};
