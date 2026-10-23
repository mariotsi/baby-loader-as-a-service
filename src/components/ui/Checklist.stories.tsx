import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Checklist } from './Checklist';

const ITEMS = [
  { id: 'length', label: 'At least 10 characters', met: true },
  { id: 'lower', label: 'A lowercase letter', met: true },
  { id: 'upper', label: 'An uppercase letter', met: false },
  { id: 'digit', label: 'A number', met: true },
  { id: 'symbol', label: 'A symbol, such as ! ? @ # $ % & * - _', met: false },
];

const meta = {
  title: 'Components/Checklist',
  component: Checklist,
  tags: ['autodocs'],
  args: { items: ITEMS },
} satisfies Meta<typeof Checklist>;

export default meta;
type Story = StoryObj<typeof meta>;

/** While the person types: met items tick off, the rest wait quietly. */
export const InProgress: Story = {};

/** After a submit the missing items block: they are flagged in the error color. */
export const FlaggedAfterSubmit: Story = { args: { flagUnmet: true } };

export const AllMet: Story = { args: { items: ITEMS.map((item) => ({ ...item, met: true })) } };
