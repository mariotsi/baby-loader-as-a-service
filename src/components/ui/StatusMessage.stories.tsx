import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Button } from './Button';
import { Stack } from './Stack';
import { StatusMessage } from './StatusMessage';

const meta = {
  title: 'Components/StatusMessage',
  component: StatusMessage,
  tags: ['autodocs'],
  args: { tone: 'success', children: 'Saved. Your page is up to date.' },
} satisfies Meta<typeof StatusMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};

export const Danger: Story = { args: { tone: 'danger', children: "Couldn't save your changes. Try again." } };

export const Info: Story = { args: { tone: 'info', children: 'Sent to 12 of 12 subscribers.' } };

/** Keep it mounted and change its message: the live region then announces each new one. */
export const Announced: Story = {
  render: function AnnouncedStory() {
    const [message, setMessage] = useState<string | null>(null);
    return (
      <Stack gap={3} align="start">
        <Button variant="primary" onClick={() => setMessage('Saved. Your page is up to date.')}>
          Save changes
        </Button>
        <StatusMessage tone="success">{message}</StatusMessage>
      </Stack>
    );
  },
};
