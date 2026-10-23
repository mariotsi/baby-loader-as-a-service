import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';
import { Stack } from './Stack';

const meta = {
  title: 'Components/Stack',
  component: Stack,
  tags: ['autodocs'],
  args: {
    gap: 3,
    children: (
      <>
        <Button>Subscribers</Button>
        <Button>Send notification</Button>
        <Button variant="primary">View page</Button>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Column: Story = { args: { align: 'start' } };

/** Wraps onto a new line when the screen runs out of room. */
export const Row: Story = { args: { direction: 'row' } };
