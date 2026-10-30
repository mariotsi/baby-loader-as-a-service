import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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
