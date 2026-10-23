import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ButtonLink } from './Button';
import { Card } from './Card';
import { PageShell } from './PageShell';

const meta = {
  title: 'Components/PageShell',
  component: PageShell,
  tags: ['autodocs'],
  parameters: { page: true },
  args: {
    width: 'medium',
    children: (
      <Card title="Your sites" headingLevel={1}>
        <p style={{ margin: 0 }}>The page content goes here.</p>
      </Card>
    ),
  },
  argTypes: { children: { control: false }, nav: { control: false } },
} satisfies Meta<typeof PageShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};

/** A sign-in card. */
export const Narrow: Story = { args: { width: 'narrow' } };

/** With a way back in the header, as on a Dashboard subpage. */
export const WithNav: Story = {
  args: {
    width: 'wide',
    nav: (
      <ButtonLink href="/admin" variant="ghost" size="sm">
        Your sites
      </ButtonLink>
    ),
  },
};
