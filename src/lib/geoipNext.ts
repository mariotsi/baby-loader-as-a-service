import { getCloudflareContext } from '@opennextjs/cloudflare';
import { type GeoLocation, geoFromCf } from './geoip.ts';

/** Where Cloudflare places the request being answered, or null where nothing places it. */
export async function requestGeo(): Promise<GeoLocation | null> {
  const context = await getCloudflareContext({ async: true }).catch(() => null);
  return geoFromCf(context?.cf);
}
