import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HomeDeck } from './HomeDeck';

const meta = {
  title: 'Pages/HomeDeck',
  component: HomeDeck,
  tags: ['autodocs'],
} satisfies Meta<typeof HomeDeck>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The pile beside the home page's pitch: the top card leaves every few seconds, and rests under the pointer. */
export const Default: Story = {};
