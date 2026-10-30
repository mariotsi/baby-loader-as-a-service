import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from './Button';
import { Card } from './Card';
import { Field } from './Field';
import { FullPageDialog } from './FullPageDialog';
import { Input } from './Input';
import { StatusMessage } from './StatusMessage';
import { Textarea } from './Textarea';

const meta = {
  title: 'Components/FullPageDialog',
  component: FullPageDialog,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    title: 'Welcome, Emma',
    description: 'Share the first details. Announcing switches your page to the Birth details.',
    closeLabel: 'Close without saving',
    onClose: () => {},
    onSubmit: () => {},
    actions: null,
    children: null,
  },
  render: function Example(args) {
    const [open, setOpen] = useState(args.open);
    return (
      <>
        <Button icon="megaphone" onClick={() => setOpen(true)}>
          Announce the birth
        </Button>
        <FullPageDialog
          {...args}
          open={open}
          onClose={() => setOpen(false)}
          onSubmit={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
          actions={
            <>
              <StatusMessage tone="danger">{null}</StatusMessage>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" type="submit" icon="megaphone" loading={args.busy}>
                {args.busy ? 'Announcing…' : 'Announce the birth'}
              </Button>
            </>
          }
        >
          <Card>
            <Field label="Birth date & time">
              <Input type="datetime-local" defaultValue="2026-10-26T08:30" />
            </Field>
            <Field label="Message" optional>
              <Textarea />
            </Field>
          </Card>
        </FullPageDialog>
      </>
    );
  },
} satisfies Meta<typeof FullPageDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One step that changes a lot at once, on a screen of its own: the first field has the focus. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog', { name: 'Welcome, Emma' });
    await expect(within(dialog).getByLabelText('Birth date & time')).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(dialog).not.toBeVisible();
  },
};
/** While its action runs the dialog stays open: Escape and the close button wait for it. */
export const Busy: Story = { args: { busy: true } };

/** Wide, for a step that shows previews beside its fields, like announcing the birth. */
export const Wide: Story = { args: { width: 'wide' } };
