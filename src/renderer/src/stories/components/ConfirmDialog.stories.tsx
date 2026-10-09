import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { Button } from '@ui/primitives/button';

const meta = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
    title: 'Remove Second Hunter?',
    description:
      'The key of Second Hunter, what was read from Steam and its notes, checklists and pinned achievements are deleted from this computer. Nothing changes on Steam.',
    confirmLabel: 'Remove',
  },
  argTypes: {
    onOpenChange: { table: { category: 'Event Listeners' } },
    onConfirm: { table: { category: 'Event Listeners' } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Asks before something is deleted for good. The title is the question and names what is lost; one paragraph says exactly what is deleted and what is not; the destructive button's label is the verb. Never used for something that can be undone.",
      },
      // A dialog covers the page: in the docs it opens from a button.
      story: { inline: false, iframeHeight: 360 },
    },
  },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};

/** As it is met in the app: behind a destructive button, with a way back. */
export const FromAButton: Story = {
  args: { open: false },
  render: function Render(props) {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <>
        <Button variant="destructive" onClick={() => setIsOpen(true)}>
          Remove account
        </Button>
        <ConfirmDialog
          {...props}
          open={isOpen}
          onOpenChange={setIsOpen}
          onConfirm={() => setIsOpen(false)}
        />
      </>
    );
  },
};
