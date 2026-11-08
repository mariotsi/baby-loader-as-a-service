import { getSiteBySlug } from '@/lib/site';
import { deploymentSiteMedia } from '@/lib/siteMediaNext';

/** Serves only a Site's own Birth video, and the photo published once it is Born, from the deployment's own bucket. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  if (kind !== 'photo' && kind !== 'video') {
    return new Response(null, { status: 404 });
  }
  const site = await getSiteBySlug(slug);
  // The editor previews the Birth video before the birth, so it is served in the Waiting state too.
  const response =
    site &&
    (await deploymentSiteMedia().read(site, kind, new URL(request.url).searchParams.get('key'), request.headers));
  return response ?? new Response(null, { status: 404 });
}
