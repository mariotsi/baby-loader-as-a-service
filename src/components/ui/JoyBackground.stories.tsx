import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { JoyBackground } from './JoyBackground';

const meta = {
  title: 'Components/JoyBackground',
  component: JoyBackground,
  tags: ['autodocs'],
  parameters: { page: true },
} satisfies Meta<typeof JoyBackground>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Scroll, move the mouse or touch the screen: the three circles drift at different depths, and settle when the finger lifts. */
export const Parallax: Story = {
  render: () => (
    <div style={{ position: 'relative', isolation: 'isolate', minHeight: '220dvh' }}>
      <JoyBackground />
      <p
        style={{
          position: 'relative',
          margin: 0,
          padding: 'var(--space-7) var(--gutter)',
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 'var(--font-display-weight)',
          fontSize: 'var(--text-2xl)',
        }}
      >
        Scroll, move the mouse or touch the screen
      </p>
    </div>
  ),
};
