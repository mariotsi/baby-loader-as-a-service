import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';

type LanguageMode = 'en' | 'it' | 'both';

const LANGUAGE_MODES = [
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'both', label: 'Both' },
] satisfies { value: LanguageMode; label: string }[];

const meta = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  args: { legend: 'Language', options: LANGUAGE_MODES, value: 'en', onChange: () => undefined },
  render: function SegmentedStory(args) {
    const [value, setValue] = useState(args.value);
    return <SegmentedControl {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof SegmentedControl<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Language mode of a Site. */
export const LanguageMode: Story = {};

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
