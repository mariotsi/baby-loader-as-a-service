import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/lib/site';
import { shareImage } from '@/lib/siteImages';
import { secondsUntilMidnight, shareImageLang } from '@/lib/siteMeta';

/**
 * A Site's share image, drawn from its Site settings as they are now, in the
 * Language its URL names (`l`). The URL also carries the day (see
 * shareImageDay), and the image is cached until midnight in the Site's
 * Timezone, when the Countdown changes.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) {
    notFound();
  }
  const now = new Date();
  const seconds = secondsUntilMidnight(site.timezone, now);
  const lang = shareImageLang(new URL(req.url).searchParams.get('l'), site.languages);
  return shareImage(site, lang, now, { 'Cache-Control': `public, max-age=${seconds}, s-maxage=${seconds}` });
}
