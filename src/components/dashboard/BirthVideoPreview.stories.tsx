import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { LangProvider } from '@/components/LangProvider';
import { PublicPage } from '@/components/PublicPage';
import { PageShell } from '@/components/ui/PageShell';
import { publicPageViews } from '@/lib/publicPageView';
import type { SiteDTO } from '@/lib/site';
import { defaultSiteSettings } from '@/lib/siteSettings';
import { SiteSettingsForm } from './SiteSettingsForm';

const videoUrl = new URL('./fixtures/welcome.webm', import.meta.url).href;
const site = {
  ...defaultSiteSettings,
  id: 'preview-emma',
  ownerId: 'preview-owner',
  slug: 'emma-preview',
  createdAt: '2026-10-26T08:30:00Z',
  updatedAt: '2026-10-29T10:00:00Z',
  customDomain: null,
  customDomainVerified: false,
  babyName: 'Emma',
  sex: 'female',
  dueDate: null,
  pageName: { en: 'Stefania and Simone' },
  birth: {
    born: true,
    details: {
      datetime: '2026-10-26T08:30:00Z',
      weightGrams: 3015,
      lengthCm: 46,
      message: { en: 'Welcome to the world, little one. We are so happy you are here.' },
      video: { key: 'preview/welcome', url: videoUrl, name: 'welcome.webm', type: 'video/webm', size: 260096 },
    },
  },
} satisfies SiteDTO;

const meta = {
  title: 'Dashboard/Birth video preview',
  parameters: { page: true, nextjs: { appDirectory: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The complete Site editor with a configured welcome video and explicit reveal preview. */
export const SiteEdit: Story = {
  render: () => (
    <LangProvider lang="en">
      <PageShell width="wide">
        <h1>Edit Emma’s page</h1>
        <SiteSettingsForm
          site={site}
          timeZones={['Europe/Rome', 'Europe/London', 'America/New_York']}
          address="https://emma-preview.loading.baby"
        />
      </PageShell>
    </LangProvider>
  ),
};

/** A Born Public page with automatic reveal and replay, using a local sample video. */
export const BornPublicPage: Story = {
  render: () => (
    <PublicPage
      views={publicPageViews(site)}
      initialLang="en"
      slug={site.slug}
      vapidPublicKey={undefined}
      birthVideoUrl={videoUrl}
      disableNotifications
    />
  ),
};

/** Browsers that block audible autoplay offer an explicit action to enable sound. */
export const AudioAutoplayBlocked: Story = {
  ...BornPublicPage,
  beforeEach: () => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.muted) {
        return Promise.reject(new DOMException('Audio needs a gesture.', 'NotAllowedError'));
      }
      return original.call(this);
    };
    return () => {
      HTMLMediaElement.prototype.play = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const current = canvas.queryByRole('dialog');
    if (current) {
      await userEvent.click(within(current).getByRole('button', { name: 'Close video' }));
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Replay the welcome' }));
    const dialog = await canvas.findByRole('dialog');
    const video = dialog.querySelector('video');
    if (!video) {
      throw new Error('The reveal needs a video.');
    }
    await expect(video).not.toHaveAttribute('controls');
    await expect(getComputedStyle(dialog).backgroundColor).toBe('rgb(0, 0, 0)');
    const sound = await within(dialog).findByRole('button', { name: 'Turn on sound' });
    await waitFor(() => expect(video.muted).toBe(true));
    await userEvent.click(sound);
    await expect(video.muted).toBe(false);
    await expect(within(dialog).queryByRole('button', { name: 'Turn on sound' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close video' }));
  },
};

const italianSite: SiteDTO = {
  ...site,
  languages: ['it'],
  pageName: { it: 'Stefania e Simone' },
  birth: {
    born: true,
    details: {
      ...site.birth.details,
      message: { it: 'Benvenuta al mondo, piccolina. Siamo felici che tu sia qui.' },
    },
  },
};

/** The complete editor shows its Italian labels, file picker and reveal actions. */
export const SiteEditItalian: Story = {
  render: () => (
    <LangProvider lang="it">
      <PageShell width="wide">
        <h1>Modifica la pagina di Emma</h1>
        <SiteSettingsForm
          site={italianSite}
          timeZones={['Europe/Rome', 'Europe/London', 'America/New_York']}
          address="https://emma-preview.loading.baby"
        />
      </PageShell>
    </LangProvider>
  ),
};

/** The Born public page offers its welcome video and replay in Italian. */
export const BornPublicPageItalian: Story = {
  render: () => (
    <LangProvider lang="it">
      <PublicPage
        views={publicPageViews(italianSite)}
        initialLang="it"
        slug="emma-preview-it"
        vapidPublicKey={undefined}
        birthVideoUrl={videoUrl}
        disableNotifications
      />
    </LangProvider>
  ),
};
