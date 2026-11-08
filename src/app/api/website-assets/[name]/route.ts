import { mediaResponse } from '@/lib/mediaStore';
import { deploymentMediaStore } from '@/lib/siteMediaNext';
import { isWebsiteAssetName } from '@/lib/websiteAssets';

/** Serves website artwork from this deployment's R2 bucket on the page's authenticated origin. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isWebsiteAssetName(name)) {
    return new Response(null, { status: 404 });
  }
  const object = await deploymentMediaStore().get(`website-assets/${name}`);
  return object ? mediaResponse(object, 'private, max-age=3600') : new Response(null, { status: 404 });
}
