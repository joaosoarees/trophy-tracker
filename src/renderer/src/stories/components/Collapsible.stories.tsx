import { type Meta, type StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Collapsible } from '@ui/components/Collapsible';
import { Button } from '@ui/primitives/button';

const meta = {
  title: 'Components/Collapsible',
  component: Collapsible,
  args: { open: true, children: null },
  argTypes: { children: { control: false } },
  parameters: {
    docs: {
      description: {
        component:
          'A section that opens in place: it grows to its height when it opens and shrinks back when it closes. What opens in place closes the same way. Closed, it is not in the page at all: it stays mounted only while the closing transition runs.',
      },
    },
  },
} satisfies Meta<typeof Collapsible>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Toggled: Story = {
  render: function Render() {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <div className="bg-card rounded-lg border p-3">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          Note
        </Button>
        <Collapsible open={isOpen}>
          <p className="text-muted-foreground pt-2">
            Third region, behind the waterfall. Needs the double jump from
            chapter 4.
          </p>
        </Collapsible>
      </div>
    );
  },
};
