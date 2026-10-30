import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { LangProvider } from '@/components/LangProvider';
import type { SiteSettingsError } from '@/lib/siteSettings';
import { BirthDialog, type BirthDraft } from './BirthDialog';

const waiting: BirthDraft = {
  born: false,
  datetime: '2026-10-26T08:30',
  weight: '',
  lengthCm: '',
  message: {},
  photo: null,
};
const born: BirthDraft = {
  born: true,
  datetime: '2026-10-26T08:30',
  weight: '3015',
  lengthCm: '46',
  message: { en: 'Welcome to the world, little one.', it: 'Benvenuta al mondo, piccola.' },
  photo: null,
};

const meta = {
  title: 'Dashboard/Birth dialog',
  component: BirthDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    initial: waiting,
    babyName: 'Emma',
    sex: 'female',
    languages: ['en', 'it'],
    onBabyName: () => {},
    onSex: () => {},
    hidden: { name: false, sex: false },
    check: (_birth: BirthDraft): SiteSettingsError[] => [],
    onSave: async () => ({ ok: true }),
    onClose: () => {},
  },
  decorators: [
    (Story) => (
      <LangProvider lang="en">
        <Story />
      </LangProvider>
    ),
  ],
} satisfies Meta<typeof BirthDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Announcing the birth: the date and time start from now, and announcing saves the whole page. */
export const Announce: Story = {};

/**
 * Announcing a page that has no name or sex yet, with both hidden by its
 * Privacy settings: the dialog asks for them first and says announcing shows them.
 */
export const AnnounceWithoutNameOrSex: Story = {
  args: { babyName: '', sex: 'unknown', hidden: { name: true, sex: true } },
  render: function Example(args) {
    const [babyName, setBabyName] = useState(args.babyName);
    const [sex, setSex] = useState(args.sex);
    return <BirthDialog {...args} babyName={babyName} sex={sex} onBabyName={setBabyName} onSex={setSex} />;
  },
  play: async ({ canvasElement }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await waitFor(() => expect(dialog.getByText(/Announcing shows both to everyone/)).toBeVisible());
    await userEvent.type(dialog.getByLabelText('Name'), 'Emma');
    await userEvent.click(dialog.getByRole('radio', { name: 'Girl' }));
    await expect(dialog.getByRole('heading', { name: 'Welcome, Emma' })).toBeVisible();
  },
};

/** Changing what was announced, with the way back to the Countdown. */
export const Edit: Story = { args: { initial: born } };

/** A Birth the Site settings refuse: the fields say why, and something wrong elsewhere on the page is named too. */
export const Errors: Story = {
  args: {
    initial: { ...waiting, datetime: '', weight: '3400.5' },
    check: (birth: BirthDraft): SiteSettingsError[] => [
      ...(birth.datetime ? [] : [{ path: 'birth.details.datetime', code: 'required' as const }]),
      ...(birth.weight.includes('.') ? [{ path: 'birth.details.weightGrams', code: 'invalidType' as const }] : []),
      { path: 'milestones.0.date', code: 'required' as const },
    ],
  },
  play: async ({ canvasElement }) => {
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Announce the birth' }));
    await expect(dialog.getByLabelText('Birth date & time')).toHaveFocus();
    await waitFor(() => expect(dialog.getByText(/Something else on this page needs fixing first/)).toBeVisible());
  },
};
