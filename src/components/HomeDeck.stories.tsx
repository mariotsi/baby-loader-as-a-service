import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { platformCopy } from '@/lib/copy/platform';
import { homeDeckCards, homeDeckImage } from '@/lib/homeDeck';
import { HomeDeck } from './HomeDeck';

const meta = {
  title: 'Pages/HomeDeck',
  component: HomeDeck,
  tags: ['autodocs'],
  args: {
    cards: homeDeckCards('en').map(({ slug, alt, ...card }) => ({
      slug,
      alt,
      src: `/website-assets/${homeDeckImage({ slug, ...card })}`,
    })),
    copy: platformCopy.en.marketing.deck,
  },
} satisfies Meta<typeof HomeDeck>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The pile beside the home page's pitch: the top card leaves every few seconds; swipe it or use the controls beneath. */
export const Default: Story = {};
