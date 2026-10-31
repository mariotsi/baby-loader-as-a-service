import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SectionNav } from './SectionNav';

const SECTIONS = [
  { id: 'baby', label: 'Baby details' },
  { id: 'video', label: 'Their first hello' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'who', label: 'Keep the secret' },
];

const meta = {
  title: 'Components/SectionNav',
  component: SectionNav,
  tags: ['autodocs'],
  args: { label: 'Sections of this page', sections: SECTIONS },
} satisfies Meta<typeof SectionNav>;

export default meta;
type Story = StoryObj<typeof meta>;

/** For a page long enough to lose your place in: a row of chips, or a column on a wide screen. */
export const Default: Story = {};

/** The row scrolls sideways when the sections do not fit, and fades over a cut chip at the edge that holds more. */
export const Narrow: Story = {
  render: (args) => (
    <div style={{ maxWidth: '20rem' }}>
      <SectionNav {...args} />
    </div>
  ),
};
