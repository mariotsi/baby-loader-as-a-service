import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { Stack } from './Stack';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  args: { label: 'Loading your sites' },
  argTypes: {
    size: { control: 'inline-radio', options: ['md', 'lg'] },
    tone: { control: 'inline-radio', options: ['current', 'brand'] },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In a line of text, in its color. */
export const InText: Story = {
  render: (args) => (
    <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <Spinner {...args} />
      Loading your sites…
    </p>
  ),
  args: { label: undefined },
};

/** On its own, for a whole region that is loading: the logo's colors, with a label for screen readers. */
export const Region: Story = { args: { size: 'lg', tone: 'brand' } };

/** A Button shows the Spinner by itself while `loading`; there is no need to place one. */
export const InAButton: Story = {
  render: () => (
    <Stack direction="row" gap={3}>
      <Button variant="primary" loading>
        Saving…
      </Button>
      <Button loading>Sending…</Button>
      <Button variant="ghost" loading>
        Removing…
      </Button>
    </Stack>
  ),
};
