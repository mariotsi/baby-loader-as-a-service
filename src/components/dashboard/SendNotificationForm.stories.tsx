import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { LangProvider } from '@/components/LangProvider';
import { PageShell } from '@/components/ui/PageShell';
import { SendNotificationForm } from './SendNotificationForm';

const meta = {
  title: 'Dashboard/Send notification',
  component: SendNotificationForm,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  args: {
    slug: 'emma-preview',
    languages: ['it', 'en'],
    defaultTitle: 'Emma',
    icon: '/icon-192.png',
    siteName: { it: 'Stefania e Simone', en: 'Stefania & Simone' },
    host: 'emma-preview.loading.baby',
    subscribers: 12,
    subscriptionsHref: '/dashboard/emma-preview/subscriptions',
    birth: null,
  },
  decorators: [
    (Story) => (
      <LangProvider lang="en">
        <PageShell width="wide">
          <h1>Send a notification</h1>
          <Story />
        </PageShell>
      </LangProvider>
    ),
  ],
} satisfies Meta<typeof SendNotificationForm>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Waiting: a title and a message in each of the Site's Languages, previewed as each device gets it. */
export const Waiting: Story = {};

/** Born: the birth announcement fills in the texts, and the confirmation says it goes out a second time. */
export const Born: Story = {
  args: {
    birth: {
      it: { title: 'È nata Emma!', body: 'Benvenuta al mondo, piccola.' },
      en: { title: 'Emma is born!', body: 'Welcome to the world, little one.' },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Use the birth announcement' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Send notification' }));
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await waitFor(() => expect(dialog.getByText(/already announced the birth/)).toBeVisible());
  },
};

/** A message missing in one Language names it, and nothing is sent. */
export const MissingMessage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const message = within(canvas.getByRole('group', { name: /^Message/ }));
    await userEvent.type(message.getByRole('textbox', { name: 'Italian' }), 'Manca pochissimo!');
    await userEvent.click(canvas.getByRole('button', { name: 'Send notification' }));
    await expect(canvas.getByText('Write the message in English.')).toBeInTheDocument();
  },
};
