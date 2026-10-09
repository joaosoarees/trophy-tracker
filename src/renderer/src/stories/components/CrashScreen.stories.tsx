import { type Meta, type StoryObj } from '@storybook/react-vite';

import { CrashScreen } from '@ui/components/CrashScreen';

const meta = {
  title: 'Components/CrashScreen',
  component: CrashScreen,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "What the user sees when a screen fails to draw, in place of a blank window: what happened, that the details are in the local log, and a button that reloads the window. Its texts follow the app's language (try the globe in the toolbar).",
      },
      story: { inline: false, iframeHeight: 420 },
    },
  },
} satisfies Meta<typeof CrashScreen>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
