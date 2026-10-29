import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ExternalLink } from './ExternalLink';

const meta = {
  title: 'Components/ExternalLink',
  component: ExternalLink,
  tags: ['autodocs'],
  args: { href: 'https://support.apple.com/', children: 'Open Apple Support' },
} satisfies Meta<typeof ExternalLink>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Marks external navigation and opens a new tab by default. */
export const Default: Story = {};
/** Allows an explicit target when navigation stays in the current tab. */
export const SameTab: Story = { args: { target: '_self' } };
