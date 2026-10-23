import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';
import { Card } from './Card';
import { Field } from './Field';
import { Input } from './Input';

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  args: {
    title: 'Baby details',
    description: 'What your page says about the little one.',
    children: (
      <Field label="Name">
        <Input defaultValue="Emma" />
      </Field>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 'var(--content-medium)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A titled card is a named region, so screen reader users can jump to it. */
export const WithTitle: Story = {};

/** Without a title the card is a plain box. */
export const Plain: Story = {
  args: {
    title: undefined,
    description: undefined,
    children: (
      <>
        <strong>Emma</strong>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>emma.loading.baby</p>
        <Button size="sm">Manage</Button>
      </>
    ),
  },
};
