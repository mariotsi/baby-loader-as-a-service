import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';

const VIEWS = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'born', label: 'Born' },
] satisfies { value: string; label: string }[];

const meta = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  args: { legend: 'Preview', options: VIEWS, value: 'waiting', onChange: () => undefined },
  render: function SegmentedStory(args) {
    const [value, setValue] = useState(args.value);
    return <SegmentedControl {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof SegmentedControl<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Switching a preview between the Waiting and the Born state. */
export const PreviewState: Story = {};

/** Spread across a phone-wide form. */
export const FullWidth: Story = {
  args: { fullWidth: true },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 'var(--content-narrow)' }}>
        <Story />
      </div>
    ),
  ],
};

/** The Language switcher on a Public page: compact, with the legend for screen readers only. */
export const LanguageSwitcher: Story = {
  args: {
    legend: 'Language',
    hideLegend: true,
    size: 'sm',
    value: 'it',
    options: [
      { value: 'it', label: 'IT' },
      { value: 'en', label: 'EN' },
    ],
  },
};

export const Sex: Story = {
  args: {
    legend: 'Sex',
    value: 'unknown',
    options: [
      { value: 'female', label: 'Girl' },
      { value: 'male', label: 'Boy' },
      { value: 'unknown', label: 'Rather not say' },
    ],
  },
};
