import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Switch } from './Switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: { label: "Show the baby's name while waiting" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 'var(--content-narrow)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = { args: { defaultChecked: true } };

export const Off: Story = {};

export const WithHint: Story = {
  args: { label: 'Show the sex while waiting', hint: 'After the birth your page always shows it.' },
};

/** The hint says why the setting cannot change. */
export const Disabled: Story = {
  args: { checked: false, disabled: true, readOnly: true, hint: 'There’s no name to show yet.' },
};
