import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { EmojiPicker } from './EmojiPicker';

const meta = {
  title: 'Components/EmojiPicker',
  component: EmojiPicker,
  tags: ['autodocs'],
  args: { value: '✨', onChange: () => undefined, label: 'Milestone 1 emoji' },
  render: function EmojiStory(args) {
    const [value, setValue] = useState(args.value);
    return <EmojiPicker {...args} value={value} onChange={setValue} />;
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '24rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmojiPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A Milestone's emoji, or any single emoji the Owner picks. Press it to search and pick another. */
export const Default: Story = {};

/** Joined sequences and skin tones show as one emoji. */
export const Sequence: Story = { args: { value: '👨‍👩‍👧' } };

/** An emoji newer than Twemoji shows in the device's font. The grid doesn't offer these, but a Site may already have one. */
export const NoImage: Story = { args: { value: '🫎' } };
