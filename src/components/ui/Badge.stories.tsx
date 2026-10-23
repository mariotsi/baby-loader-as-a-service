import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from './Badge';
import { Button } from './Button';
import { ICON_NAMES } from './Icon';
import { Stack } from './Stack';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Optional' },
  argTypes: { icon: { control: 'select', options: [undefined, ...ICON_NAMES] } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A plain fact about the thing beside it, like an optional field. */
export const Neutral: Story = {};

/** Something special, like a recommended choice. */
export const Highlight: Story = { args: { tone: 'highlight', icon: 'star', children: 'Recommended' } };

/** Inside a line of text, like the "optional" beside a field's label. */
export const Small: Story = { args: { size: 'sm', children: 'Optional' } };

/** Beside a Button, a Badge reads as a label, not as something to press. */
export const NextToAButton: Story = {
  render: () => (
    <Stack direction="row" gap={3}>
      <Badge tone="highlight" icon="star">
        Recommended
      </Badge>
      <Button size="sm" variant="ghost">
        Change
      </Button>
    </Stack>
  ),
};
