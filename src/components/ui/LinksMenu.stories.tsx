import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LinksMenu } from './LinksMenu';

const meta = {
  title: 'Components/LinksMenu',
  component: LinksMenu,
  tags: ['autodocs'],
  args: {
    label: 'More',
    links: [
      { href: '#subscribers', label: 'Subscribers' },
      { href: '#notifications', label: 'Notifications' },
    ],
  },
} satisfies Meta<typeof LinksMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** After a phone's main action, holding the actions that don't fit its line. */
export const Folded: Story = {};
