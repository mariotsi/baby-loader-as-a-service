import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { Card } from '@/components/ui/Card';
import { defaultSiteSettings } from '@/lib/siteSettings';
import { SitePreviews } from './SitePreviews';

function NarrowPreviews({ width }: { width: number }) {
  return (
    <div style={{ width, maxWidth: '100%' }}>
      <Card title="Sharing previews">
        <SitePreviews
          settings={{
            ...defaultSiteSettings,
            babyName: 'Emma',
            sex: 'female',
            pageName: { en: 'Stefania and Simone' },
          }}
          address="https://a-long-preview-address-loading-baby-staging.simone-716.workers.dev/sites/demo-emma"
        />
      </Card>
    </div>
  );
}
const meta = { title: 'Dashboard/Sharing previews', component: NarrowPreviews, tags: ['autodocs'] } satisfies Meta<
  typeof NarrowPreviews
>;
export default meta;
type Story = StoryObj<typeof meta>;

async function previewsFit(canvasElement: HTMLElement) {
  const card = within(canvasElement).getByRole('region', { name: 'Sharing previews' });
  const boundary = card.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(card).paddingRight);
  for (const preview of card.querySelectorAll('figure > div')) {
    await expect(preview.getBoundingClientRect().right).toBeLessThanOrEqual(boundary + 1);
  }
}

/** Sharing previews fit a 320px form without overflowing the Card's content. */
export const Phone320: Story = { args: { width: 320 }, play: async ({ canvasElement }) => previewsFit(canvasElement) };
/** Long preview Addresses fit a 375px form. */
export const Phone375: Story = { args: { width: 375 }, play: async ({ canvasElement }) => previewsFit(canvasElement) };
