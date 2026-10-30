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

/** An emoji shown as text on a page, like a Milestone's, in the device's font. Press it to search and pick another. */
export const Default: Story = {};

/** An emoji that ends up in the Site's generated images, like the Site icon, in the Twemoji those images draw. */
export const Twemoji: Story = { args: { twemoji: true, label: 'Icon emoji' } };

/** Joined sequences and skin tones show as one emoji. */
export const Sequence: Story = { args: { value: '👨‍👩‍👧' } };

/** An emoji newer than Twemoji shows in the device's font. The grid doesn't offer these, but a Site may already have one. */
export const NoImage: Story = { args: { twemoji: true, value: '🫎', label: 'Icon emoji' } };
