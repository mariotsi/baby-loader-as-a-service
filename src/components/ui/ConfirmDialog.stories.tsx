import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
  args: {
    title: 'Turn off notifications?',
    description: 'You will stop receiving notifications from this page on this device.',
    confirmLabel: 'Turn off notifications',
    dismissLabel: 'Keep notifications on',
    open: false,
    onConfirm: () => {},
    onClose: () => {},
  },
  render: function Example(args) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="link" onClick={() => setOpen(true)}>
          Turn off notifications
        </Button>
        <ConfirmDialog {...args} open={open} onClose={() => setOpen(false)} onConfirm={() => setOpen(false)} />
      </>
    );
  },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Opens a confirmation with focus on the safe action. */
export const Default: Story = {};
/** Keeps the dialog open while the confirmed operation runs: the spinner on the confirm action, the dismiss one disabled. */
export const Busy: Story = { args: { busy: true } };
