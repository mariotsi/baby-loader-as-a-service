import { getCloudflareContext } from '@opennextjs/cloudflare';

/** Serves website artwork from this deployment's R2 bucket on the page's authenticated origin. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (name !== 'born-placeholder-v1.png') {
    return new Response(null, { status: 404 });
  }
  const object = await getCloudflareContext().env.WEBSITE_ASSETS.get(`website-assets/${name}`);
  if (!object) {
    return new Response(null, { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, max-age=3600');
  return new Response(object.body, { headers });
}
