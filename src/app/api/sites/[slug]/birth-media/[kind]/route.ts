import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getSiteBySlug } from '@/lib/site';

/** Serves only the media published on a Born Site from the deployment's own bucket. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  if (kind !== 'photo' && kind !== 'video') {
    return new Response(null, { status: 404 });
  }
  const site = await getSiteBySlug(slug);
  if (!site?.birth.born) {
    return new Response(null, { status: 404 });
  }
  const media = site.birth.details[kind];
  if (
    !media ||
    media.key !== new URL(request.url).searchParams.get('key') ||
    !media.key.startsWith(`customer-data/${site.ownerId}/${site.id}/`)
  ) {
    return new Response(null, { status: 404 });
  }
  const object = await getCloudflareContext().env.WEBSITE_ASSETS.get(media.key, { range: request.headers });
  if (!object) {
    return new Response(null, { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (object.range) {
    const offset = object.range.offset ?? 0;
    const length = object.range.length ?? object.size - offset;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { headers });
}
