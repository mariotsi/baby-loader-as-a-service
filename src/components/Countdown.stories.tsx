import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, within } from 'storybook/test';
import type { Lang } from '@/lib/i18n';
import { publicPageView } from '@/lib/publicPageView';
import { defaultSiteSettings } from '@/lib/siteSettings';
import { Countdown } from './Countdown';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Stack } from './ui/Stack';

const dueDate = '2026-10-20';
function waiting(days: number, lang: 'en' | 'it' = 'en') {
  const view = publicPageView({ ...defaultSiteSettings, dueDate }, lang, new Date(Date.UTC(2026, 9, 20 + days, 10)));
  if (!view.waiting) {
    throw new Error('The countdown fixture needs a Due date.');
  }
  return view.waiting;
}

const meta = {
  title: 'Public page/Countdown',
  component: Countdown,
  tags: ['autodocs'],
  render: function Interactive(args, { parameters }) {
    const [lang, setLang] = useState<Lang>(parameters.language ?? 'en');
    return (
      <Stack gap={4} align="stretch">
        <Stack direction="row" justify="end">
          <LanguageSwitcher
            langs={['en', 'it']}
            current={lang}
            label={lang === 'it' ? 'Lingua' : 'Language'}
            onChange={setLang}
          />
        </Stack>
        <Countdown {...args} waiting={waiting(parameters.days ?? 7, lang)} />
      </Stack>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '30rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Countdown>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Six weeks before the Due date, the track shows week 34. */
export const SixWeeksBeforeDue: Story = { parameters: { days: -42 }, args: { waiting: waiting(-42) } };
/** The regular track approaches the Due date. */
export const BeforeDue: Story = { parameters: { days: -7 }, args: { waiting: waiting(-7) } };
/** The pram reaches the turn on the Due date. */
export const DueToday: Story = { parameters: { days: 0 }, args: { waiting: waiting(0) } };
/** The pram follows the curve on the first late day. */
export const OneDayLate: Story = { parameters: { days: 1 }, args: { waiting: waiting(1) } };
/** The return journey retains the week without a total. */
export const OneWeekLate: Story = {
  args: { waiting: waiting(7) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Week 41')).toBeVisible();
    await expect(canvas.getByText('Room service? I’m staying.')).toBeVisible();
    await canvas.getByRole('radio', { name: 'Italiano' }).click();
    await expect(canvas.getByText('Settimana 41')).toBeVisible();
    await expect(canvas.getByText('Servizio in camera? Io resto qui.')).toBeVisible();
    await canvas.getByRole('radio', { name: 'English' }).click();
    await expect(canvas.getByText('Week 41')).toBeVisible();
  },
};
/** At two weeks late the pram parks at the faded end. */
export const TwoWeeksLate: Story = { parameters: { days: 14 }, args: { waiting: waiting(14) } };
/** The day and week counters continue while the pram remains parked. */
export const BeyondTwoWeeks: Story = { parameters: { days: 21 }, args: { waiting: waiting(21) } };
/** Italian copy fits in a compact preview. */
export const ItalianSmall: Story = { parameters: { language: 'it' }, args: { waiting: waiting(7, 'it'), size: 'sm' } };
