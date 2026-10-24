import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Logo, LogoMark } from './Logo';
import { Stack } from './Stack';

const meta = {
  title: 'Components/Logo',
  component: Logo,
  tags: ['autodocs'],
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Platform's name, as `PageShell` shows it in every Platform page's header. Hover it: the ring turns once. */
export const Default: Story = {};

/** The mark alone, in the Palette's colors and in the text color. The `Spinner` is this mark, turning. */
export const Mark: Story = {
  render: () => (
    <Stack direction="row" gap={4} align="center">
      <span style={{ fontSize: 'var(--text-2xl)' }}>
        <LogoMark />
      </span>
      <span style={{ fontSize: 'var(--text-2xl)', color: 'var(--color-accent-ink)' }}>
        <LogoMark tone="current" />
      </span>
    </Stack>
  ),
};
