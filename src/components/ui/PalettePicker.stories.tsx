import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { DEFAULT_PALETTE } from '@/lib/theme';
import { PalettePicker } from './PalettePicker';

const meta = {
  title: 'Components/PalettePicker',
  component: PalettePicker,
  tags: ['autodocs'],
  args: { value: DEFAULT_PALETTE, onChange: () => undefined },
  argTypes: { palettes: { control: false } },
  render: function PaletteStory(args) {
    const [value, setValue] = useState(args.value);
    return <PalettePicker {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof PalettePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Wide enough for one row of six. */
export const OneRow: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 'var(--content-medium)' }}>
        <Story />
      </div>
    ),
  ],
};

/** In a phone-wide form: two rows of three. */
export const TwoRowsOnAPhone: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '20rem' }}>
        <Story />
      </div>
    ),
  ],
};
