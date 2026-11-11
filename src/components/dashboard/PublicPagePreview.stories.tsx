import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor, within } from 'storybook/test';
import { LangProvider } from '@/components/LangProvider';
import {
  calendarDaySchema,
  defaultSiteSettings,
  emojiSchema,
  isoDateTimeSchema,
  type SiteSettings,
} from '@/lib/siteSettings';
import { PublicPagePreview } from './PublicPagePreview';

const asDay = (value: string) => calendarDaySchema.parse(value);
const asEmoji = (value: string) => emojiSchema.parse(value);
const asInstant = (value: string) => isoDateTimeSchema.parse(value);

const emma: SiteSettings = {
  ...defaultSiteSettings,
  babyName: 'Emma',
  sex: 'female',
  dueDate: asDay('2026-11-02'),
  languages: ['en', 'it'],
  pageName: { en: 'Stefania & Simone', it: 'Stefania e Simone' },
};
const born: SiteSettings = {
  ...emma,
  birth: {
    born: true,
    details: {
      datetime: asInstant('2026-10-26T07:30:00.000Z'),
      weightGrams: 3015,
      lengthCm: 46,
      message: { en: 'Welcome to the world, little one.', it: 'Benvenuta al mondo, piccola.' },
      photo: null,
    },
  },
  milestones: [
    { date: asDay('2026-10-26'), label: { en: 'She is born!', it: 'È nata!' }, emoji: asEmoji('👶'), kind: 'birth' },
  ],
};

const meta = {
  title: 'Dashboard/Public page preview',
  component: PublicPagePreview,
  tags: ['autodocs'],
  args: {
    settings: born,
    slug: 'demo-emma',
    lang: 'en',
    caption: 'Your page on a phone',
  },
  decorators: [
    (Story) => (
      <LangProvider lang="en">
        <Story />
      </LangProvider>
    ),
  ],
} satisfies Meta<typeof PublicPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The page once born, at a phone's width whatever the screen: nothing in it can be pressed, not even the notifications button. */
export const Born: Story = {
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement).getByRole('region', { name: 'Your page on a phone' });
    await waitFor(() => expect(within(frame).getByText('Get the next updates')).toBeVisible());
    await expect(frame.querySelector('[inert]')).not.toBeNull();
  },
};

/** The page while waiting, with its Countdown. */
export const Waiting: Story = { args: { settings: emma } };
