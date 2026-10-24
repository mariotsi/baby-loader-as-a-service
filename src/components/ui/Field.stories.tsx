import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Field } from './Field';
import { Input } from './Input';
import { Select } from './Select';
import { Stack } from './Stack';
import { Textarea } from './Textarea';

const meta = {
  title: 'Components/Field',
  component: Field,
  tags: ['autodocs'],
  args: { label: "Baby's name", children: <Input defaultValue="Emma" /> },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 'var(--content-narrow)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithInput: Story = {};

export const WithHint: Story = {
  args: { hint: 'Only shown on the page if you want it to be. You can change it later.' },
};

/** The error says what happened and how to fix it; the control is marked invalid and points at it. */
export const WithError: Story = {
  args: {
    label: 'Page address',
    error: 'Someone got there first. Try emma-2026.',
    children: <Input defaultValue="emma" />,
  },
};

/**
 * The error reaches screen readers only, for a problem the page already shows another way: here the field is still
 * marked invalid, and a Checklist under it would flag the rules.
 */
export const ErrorForScreenReaders: Story = {
  args: {
    label: 'Password',
    error: 'Not met yet: An uppercase letter.',
    errorForScreenReaders: true,
    children: <Input type="password" defaultValue="abcdefghij1!" />,
  },
};

/**
 * The label reaches screen readers only, for a control whose row already says what it is, like a Milestone's date
 * beside its emoji. The error still shows under the control.
 */
export const LabelHidden: Story = {
  args: {
    label: 'Milestone 1 date',
    labelHidden: true,
    error: 'Pick the day.',
    children: <Input type="date" />,
  },
};

/** Mark the optional fields, not the required ones. */
export const Optional: Story = {
  args: { label: 'Due date', optional: true, children: <Input type="date" /> },
};

export const WithTextarea: Story = {
  args: {
    label: 'Birth message',
    hint: 'A few words for everyone waiting with you.',
    children: <Textarea defaultValue="Mum, baby (and dad) are doing great!" />,
  },
};

export const WithSelect: Story = {
  args: {
    label: 'Timezone',
    children: (
      <Select defaultValue="Europe/Rome">
        <option>Europe/London</option>
        <option>Europe/Rome</option>
        <option>America/New_York</option>
      </Select>
    ),
  },
};

/** A hint that changes as the person types is announced politely. */
export const LiveHint: Story = {
  render: function LiveHintStory() {
    const [slug, setSlug] = useState('emma');
    return (
      <Field label="Page address" hint={`Your page will be at ${slug || 'emma'}.loading.baby`} liveHint required>
        <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
      </Field>
    );
  },
};

/** Two Fields with the same label still get unique ids: the label always reaches its own control. */
export const RenderedTwice: Story = {
  render: () => (
    <Stack gap={5}>
      <Field label="Name">
        <Input defaultValue="Emma" />
      </Field>
      <Field label="Name">
        <Input defaultValue="Leo" />
      </Field>
    </Stack>
  ),
};
