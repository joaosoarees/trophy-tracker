import { type Meta, type StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { UpdateReadyDialog } from '@ui/components/UpdateReadyDialog';

const meta = {
  title: 'Components/UpdateReadyDialog',
  component: UpdateReadyDialog,
  args: { open: true, version: '0.7.0', onRestart: fn(), onLater: fn() },
  argTypes: {
    onRestart: { table: { category: 'Event Listeners' } },
    onLater: { table: { category: 'Event Listeners' } },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Shown when a version finished downloading while the app is in use. The app never restarts by itself while in use: this asks, and "Later" is a real answer.',
      },
      story: { inline: false, iframeHeight: 320 },
    },
  },
} satisfies Meta<typeof UpdateReadyDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
