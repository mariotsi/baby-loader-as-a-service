import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { platformCopy } from '@/lib/copy/platform';
import { HomeDeck } from './HomeDeck';

const meta = {
  title: 'Pages/HomeDeck',
  component: HomeDeck,
  tags: ['autodocs'],
  args: { lang: 'en', copy: platformCopy.en.marketing.deck },
  argTypes: { lang: { control: 'inline-radio', options: ['en', 'it'] } },
} satisfies Meta<typeof HomeDeck>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The pile beside the home page's pitch: the top card leaves every few seconds; swipe it or use the controls beneath. */
export const Default: Story = {};
