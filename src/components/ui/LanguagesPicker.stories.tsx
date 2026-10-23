import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { LanguagesPicker } from './LanguagesPicker';

const meta = {
  title: 'Components/LanguagesPicker',
  component: LanguagesPicker,
  tags: ['autodocs'],
  args: { value: ['en'], onChange: () => undefined },
  render: function LanguageStory(args) {
    const [value, setValue] = useState(args.value);
    return <LanguagesPicker {...args} value={value} onChange={setValue} />;
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 'var(--content-narrow)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LanguagesPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One Language: the page speaks only English and shows no switcher. Try unticking it. */
export const One: Story = {};

/** Two Languages: Visitors switch between them, and browsers asking for neither get English. */
export const Two: Story = { args: { value: ['it', 'en'] } };
