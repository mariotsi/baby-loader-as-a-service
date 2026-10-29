import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button, ButtonLink } from './Button';
import { ICON_NAMES } from './Icon';
import { Stack } from './Stack';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Save changes', variant: 'secondary' },
  argTypes: {
    icon: { control: 'select', options: [undefined, ...ICON_NAMES] },
    iconPosition: { control: 'inline-radio', options: ['start', 'end'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The one main action of a view. A view has at most one. */
export const Primary: Story = { args: { variant: 'primary', children: "Create Emma's page", icon: 'sparkles' } };

/** The default: every action that is not the main one. */
export const Secondary: Story = {};

/** Quiet, often repeated actions, like adding a Milestone. */
export const Ghost: Story = { args: { variant: 'ghost', icon: 'plus', children: 'Add milestone' } };

/** While work is in flight: the label says what is happening, presses are ignored, focus stays. */
export const Loading: Story = { args: { variant: 'primary', loading: true, children: 'Saving…' } };

/** An icon after the label, for actions that move forward or leave the page. */
export const IconAtTheEnd: Story = {
  args: { variant: 'primary', icon: 'arrow-right', iconPosition: 'end', children: 'Next: the big day' },
};

/** While loading, the Spinner takes the icon's place, at the end too. */
export const LoadingWithIconAtTheEnd: Story = {
  args: { variant: 'primary', icon: 'arrow-right', iconPosition: 'end', loading: true, children: 'Saving…' },
};

/** For dense rows like a Milestone's remove action. Still at least 44px tall. */
export const Small: Story = { args: { size: 'sm', icon: 'trash', children: 'Remove' } };

/** Only the icon, in a dense row that repeats the action, like a Milestone's remove. The label still names it for screen readers. */
export const IconOnly: Story = { args: { icon: 'trash', labelHidden: true, children: 'Remove milestone 1' } };

/** Stretches across a phone-wide form. */
export const FullWidth: Story = {
  args: { variant: 'primary', fullWidth: true, icon: 'arrow-right', iconPosition: 'end', children: 'Next' },
};

/** Navigation looks the same but stays a link, so it opens in a new tab and reads as a link. */
export const AsLink: Story = {
  render: () => (
    <Stack direction="row" gap={3}>
      <ButtonLink href="/signup" variant="primary">
        Create your page
      </ButtonLink>
      <ButtonLink href="/login">Log in</ButtonLink>
    </Stack>
  ),
};

/** One primary, the rest secondary or ghost. */
export const InAGroup: Story = {
  render: () => (
    <Stack direction="row" gap={3}>
      <Button>Back</Button>
      <Button variant="primary" icon="arrow-right" iconPosition="end">
        Next: the big day
      </Button>
      <Button variant="ghost">Skip for now</Button>
    </Stack>
  ),
};

/** A muted text action with a full touch target. */
export const Link: Story = { args: { variant: 'link', children: 'Turn off notifications' } };
