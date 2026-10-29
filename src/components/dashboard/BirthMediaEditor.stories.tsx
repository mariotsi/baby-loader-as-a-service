import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { PublicPage } from '@/components/PublicPage';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Stack } from '@/components/ui/Stack';
import { publicPageViews } from '@/lib/publicPageView';
import { defaultSiteSettings } from '@/lib/siteSettings';
import { BirthMediaEditor, type MediaDraft, useMediaUrl } from './BirthMediaEditor';

function InteractiveBirthMedia() {
  const [photo, setPhoto] = useState<MediaDraft>(null);
  const [video, setVideo] = useState<MediaDraft>(null);
  const [view, setView] = useState('editor');
  const photoUrl = useMediaUrl(photo);
  const videoUrl = useMediaUrl(video);
  const settings = {
    ...defaultSiteSettings,
    babyName: 'Emma',
    sex: 'female' as const,
    pageName: { en: 'Stefania and Simone' },
    birth: {
      born: true as const,
      details: {
        datetime: '2026-10-26T08:30:00Z',
        weightGrams: 3015,
        lengthCm: 46,
        message: { en: 'Welcome to the world, little one. We are so happy you are here.' },
      },
    },
  };
  return (
    <Stack gap={5}>
      <Card
        title="Emma’s first hello"
        description="Try a photo or video, then switch to Emma’s page. This preview keeps files in your browser."
      >
        <SegmentedControl
          legend="Preview"
          value={view}
          onChange={setView}
          options={[
            { value: 'editor', label: 'Edit birth media' },
            { value: 'page', label: 'Emma’s page' },
          ]}
        />
      </Card>
      {view === 'editor' ? (
        <BirthMediaEditor photo={photo} video={video} onPhoto={setPhoto} onVideo={setVideo} />
      ) : (
        <PublicPage
          views={publicPageViews(settings)}
          initialLang="en"
          slug="emma-preview"
          vapidPublicKey={undefined}
          bornImageUrl={photoUrl}
          birthVideoUrl={videoUrl}
          disableNotifications
          disableVideoAutoplay
        />
      )}
    </Stack>
  );
}

const meta = { title: 'Dashboard/Birth media', component: InteractiveBirthMedia, tags: ['autodocs'] } satisfies Meta<
  typeof InteractiveBirthMedia
>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Local photo and video selection, removal and the public announcement preview. */
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bytes = Uint8Array.from(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),
      (c) => c.charCodeAt(0)
    );
    await userEvent.upload(
      canvas.getByLabelText('Birth photo file', { exact: true }),
      new File([bytes], 'hello.png', { type: 'image/png' })
    );
    await expect(await canvas.findByAltText('Birth photo preview')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove photo' }));
    await expect(canvas.queryByAltText('Birth photo preview')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('radio', { name: 'Emma’s page' }));
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent('Emma');
    await userEvent.click(canvas.getByRole('radio', { name: 'Edit birth media' }));
  },
};
