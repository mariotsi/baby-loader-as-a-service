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

/** Aligns feedback with controls that fill their container. */
export const FullWidth: Story = { args: { fullWidth: true } };

/** A heading aligns with the icon above longer instructions. */
export const WithTitle: Story = {
  args: {
    tone: 'info',
    title: 'How to enable notifications',
    children: 'Add this page to your Home Screen, then open the app to turn notifications on.',
    fullWidth: true,
  },
};

/** Wrapped text keeps the icon beside its first line. */
export const Multiline: Story = {
  args: { tone: 'info', children: 'Add this page to your Home Screen, then open the app to turn notifications on.' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '18rem' }}>
        <Story />
      </div>
    ),
  ],
};
