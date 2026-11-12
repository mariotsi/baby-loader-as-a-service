import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { LangProvider } from '@/components/LangProvider';
import { siteIdSchema, userIdSchema } from '@/db/ids';
import { slugSchema } from '@/lib/address';
import type { Site } from '@/lib/site';
import { createSiteEditing } from '@/lib/siteEditing';
import { memorySiteEditingPort } from '@/lib/siteEditingPort';
import {
  type CalendarDay,
  calendarDaySchema,
  centimetresSchema,
  defaultSiteSettings,
  emojiSchema,
  gramsSchema,
  isoDateTimeSchema,
} from '@/lib/siteSettings';
import { bornPlaceholderUrl } from '@/lib/websiteAssets';
import { BirthDialog } from './BirthDialog';

/** Emma's Site, Waiting. It has no Due date, so no story depends on the day it runs. */
const waiting: Site = {
  ...defaultSiteSettings,
  id: siteIdSchema.parse('7a2e3d4c-5b6f-4071-9283-94a516b7c8d9'),
  ownerId: userIdSchema.parse('6f1d2c3b-4a5e-4f60-8172-839405a6b7c8'),
  slug: slugSchema.parse('demo-emma'),
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  customDomain: null,
  customDomainVerified: false,
  babyName: 'Emma',
  sex: 'female',
  languages: ['en', 'it'],
  pageName: { en: 'Stefania & Simone', it: 'Stefania e Simone' },
  privacy: { showName: true, showSex: true },
};

/** The same Site once the birth is announced. */
const born: Site = {
  ...waiting,
  birth: {
    born: true,
    details: {
      datetime: isoDateTimeSchema.parse('2026-10-26T07:30:00.000Z'),
      weightGrams: gramsSchema.parse(3015),
      lengthCm: centimetresSchema.parse(46),
      message: { en: 'Welcome to the world, little one.', it: 'Benvenuta al mondo, piccola.' },
      photo: null,
    },
  },
  milestones: [
    {
      date: calendarDaySchema.parse('2026-10-26'),
      label: { en: 'She is born!', it: 'È nata!' },
      emoji: emojiSchema.parse('👶'),
      kind: 'birth',
    },
  ],
};

interface ExampleProps {
  /** The Site as saved when the dialog opens. */
  site: Site;
  /** Whether the Site changed in another tab since this one read it. */
  changedElsewhere?: boolean;
  /** Called when the dialog sets the Birth. */
  onSetBirth: () => void;
}

/** The Birth dialog on a Site editing that saves in memory. */
function Example({ site, changedElsewhere = false, onSetBirth }: ExampleProps) {
  const [editing] = useState(() => {
    const port = memorySiteEditingPort(site);
    if (changedElsewhere) {
      port.changeElsewhere();
    }
    return createSiteEditing(site, {
      ...port,
      setBirth(body) {
        onSetBirth();
        return port.setBirth(body);
      },
    });
  });
  return (
    <BirthDialog
      editing={editing}
      address="https://emma.loading.baby"
      bornPlaceholderUrl={bornPlaceholderUrl('development')}
      onClose={() => {}}
    />
  );
}

const meta = {
  title: 'Dashboard/Birth dialog',
  component: Example,
  parameters: { layout: 'fullscreen' },
  args: { site: waiting, onSetBirth: fn() },
  decorators: [
    (Story) => (
      <LangProvider lang="en">
        <Story />
      </LangProvider>
    ),
  ],
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Announcing the birth: the date and time start from now, and beside the
 * fields the notification and the page on a phone show what announcing sends
 * and shows.
 */
export const Announce: Story = {};

/** Announcing asks first, so a slip of the finger cannot send the notification; then it saves the Birth. */
export const AnnounceAsksFirst: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(body.getByRole('dialog', { name: 'Welcome, Emma' }));
    await waitFor(() => expect(dialog.getByText('Emma is born!')).toBeVisible());
    await expect(dialog.getByRole('region', { name: 'Your page on a phone' })).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Announce the birth' }));
    const confirm = within(await body.findByRole('dialog', { name: 'Announce the birth now?' }));
    await expect(confirm.getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    await expect(args.onSetBirth).not.toHaveBeenCalled();
    await userEvent.click(confirm.getByRole('button', { name: 'Announce the birth' }));
    await waitFor(() => expect(args.onSetBirth).toHaveBeenCalledOnce());
  },
};

/**
 * Announcing a page that has no name or sex yet, with both hidden by its
 * Privacy settings: the dialog asks for them first and says announcing shows them.
 */
export const AnnounceWithoutNameOrSex: Story = {
  args: { site: { ...waiting, babyName: '', sex: 'unknown', privacy: { showName: false, showSex: false } } },
  play: async ({ canvasElement }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await waitFor(() => expect(dialog.getByText(/Announcing shows both to everyone/)).toBeVisible());
    await userEvent.type(dialog.getByLabelText('Name'), 'Emma');
    await userEvent.click(dialog.getByRole('radio', { name: 'Girl' }));
    await expect(dialog.getByRole('heading', { name: 'Welcome, Emma' })).toBeVisible();
  },
};

/** Changing what was announced, with the way back to the Countdown. */
export const Edit: Story = { args: { site: born } };

/**
 * A Birth the Site settings refuse: the fields say why, and something wrong
 * elsewhere on the page, here a Milestone saved without its date, is named too.
 */
export const Errors: Story = {
  args: {
    site: {
      ...waiting,
      milestones: [{ emoji: emojiSchema.parse('🩺'), label: { en: 'First scan' }, date: '' as CalendarDay }],
    },
  },
  play: async ({ canvasElement }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await userEvent.clear(dialog.getByLabelText('Birth date & time'));
    await userEvent.type(dialog.getByLabelText(/Weight/), '3400.5');
    await userEvent.click(dialog.getByRole('button', { name: 'Announce the birth' }));
    await expect(dialog.getByLabelText('Birth date & time')).toHaveFocus();
    await waitFor(() => expect(dialog.getByText(/Something else on this page needs fixing first/)).toBeVisible());
  },
};

/** A save from a tab that missed a change made elsewhere: the dialog says so and offers to reload. */
export const StaleTab: Story = {
  args: { site: born, changedElsewhere: true },
  play: async ({ canvasElement }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(dialog.getByText(/changed in another tab/)).toBeVisible());
    await expect(dialog.getByRole('button', { name: 'Reload' })).toBeVisible();
  },
};
