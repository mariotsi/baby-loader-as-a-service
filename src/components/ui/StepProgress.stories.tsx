import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StepProgress } from './StepProgress';

const meta = {
  title: 'Components/StepProgress',
  component: StepProgress,
  tags: ['autodocs'],
  args: {
    label: 'Creating your page',
    steps: ['The basics', 'Make it yours', 'Who sees what', 'A last look'],
    current: 1,
  },
} satisfies Meta<typeof StepProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Above a form of a few short steps. */
export const Default: Story = {};

/** The first step, with nothing done yet. */
export const FirstStep: Story = { args: { current: 0 } };

/** The last step, with everything before it done. */
export const LastStep: Story = { args: { current: 3 } };
