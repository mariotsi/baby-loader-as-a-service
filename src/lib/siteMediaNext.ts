import { getCloudflareContext } from '@opennextjs/cloudflare';
import { mediaEnv } from './env.ts';
import { cloudflareCachePurge, type MediaStore, noCachePurge, r2MediaStore } from './mediaStore.ts';
import { type SiteMedia, siteMedia } from './siteMedia.ts';

/** This deployment's R2 bucket, through the Worker's binding (a local one under `npm run dev`). */
export function deploymentMediaStore(): MediaStore {
  return r2MediaStore(getCloudflareContext().env.WEBSITE_ASSETS);
}

/** Site media in this deployment's bucket, purged from its media domain's cache. */
export function deploymentSiteMedia(): SiteMedia {
  const { publicUrl, purge } = mediaEnv();
  return siteMedia({
    store: deploymentMediaStore(),
    purge: purge ? cloudflareCachePurge(purge) : noCachePurge,
    publicUrl,
  });
}
