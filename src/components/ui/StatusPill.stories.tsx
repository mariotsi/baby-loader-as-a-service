import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';
import { StatusPill } from './StatusPill';

const meta = {
  title: 'Components/StatusPill',
  component: StatusPill,
  tags: ['autodocs'],
  args: { children: 'Notifications on for this device' },
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A lasting state that needs no attention. */
export const Plain: Story = {};

/** With one quiet action to change the state, like turning notifications off. */
export const WithAction: Story = {
  args: {
    action: (
      <Button variant="link" size="sm" inline onClick={() => {}}>
        Turn off
      </Button>
    ),
  },
};
