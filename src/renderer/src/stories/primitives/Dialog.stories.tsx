import { type Meta, type StoryObj } from '@storybook/react-vite';

import { Button } from '@ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ui/primitives/dialog';

const meta = {
  title: 'Primitives/Dialog',
  component: Dialog,
  parameters: {
    docs: {
      description: {
        component:
          'The one thing in the app that floats over the page: it has a shadow, over a 50 percent black scrim. A destructive question uses `ConfirmDialog`, built on this.',
      },
    },
  },
} satisfies Meta<typeof Dialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Paste a list</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Paste a list</DialogTitle>
          <DialogDescription>
            One item per line. Each line becomes an item of the checklist.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button>Add items</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
