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
    born: false,
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

/** Waiting: the confirmation says this is a regular notification and points to announcing the birth. */
export const ConfirmWhileWaiting: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const lang of ['Italian', 'English']) {
      const message = within(canvas.getByRole('group', { name: /^Message/ }));
      await userEvent.type(message.getByRole('textbox', { name: lang }), 'Manca pochissimo!');
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Send notification' }));
    const dialog = within(within(canvasElement.ownerDocument.body).getByRole('dialog'));
    await waitFor(() => expect(dialog.getByText(/use “Announce the birth”/)).toBeVisible());
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
