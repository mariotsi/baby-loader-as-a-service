import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { PhoneStrip } from './PhoneStrip';

const meta = {
  title: 'Components/PhoneStrip',
  component: PhoneStrip,
  tags: ['autodocs'],
  args: {
    children: 'Step 2 of 4',
    showLabel: 'Preview your page',
    hideLabel: 'Hide the preview',
    open: false,
    onToggle: () => {},
    controls: 'phone-strip-story',
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', paddingInline: 'var(--gutter)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Below 48rem, above a form whose preview sits beside it on a wider screen. */
export const Closed: Story = {};

/** The button says what pressing it does next. */
export const Open: Story = { args: { open: true } };

/** At 320 pixels a long name ends in an ellipsis, and the button keeps its place. */
export const LongName: Story = {
  args: { children: 'Maria Antonietta Giovanna Elisabetta' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '20rem' }}>
        <Story />
      </div>
    ),
  ],
};

/** Press it to see both labels. */
export const Toggling: Story = {
  render: function ToggleStory(args) {
    const [open, setOpen] = useState(false);
    return <PhoneStrip {...args} open={open} onToggle={() => setOpen(!open)} />;
  },
};
