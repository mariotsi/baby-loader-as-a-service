import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { DEFAULT_FONT } from '@/lib/theme';
import { FontPicker } from './FontPicker';

const meta = {
  title: 'Components/FontPicker',
  component: FontPicker,
  tags: ['autodocs'],
  args: { value: DEFAULT_FONT, onChange: () => undefined },
  argTypes: { fonts: { control: false } },
  render: function FontStory(args) {
    const [value, setValue] = useState(args.value);
    return <FontPicker {...args} value={value} onChange={setValue} />;
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 'var(--content-medium)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FontPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The baby's name as the sample, so the Owner sees their own page. */
export const WithTheBabysName: Story = { args: { sample: 'Emma' } };
