import { NextResponse } from 'next/server';
import type { BirthWrite, BirthWriteDeps } from './birthChange.ts';
import { routeError } from './routeError.ts';
import { toSiteDTO } from './site.ts';
import { deploymentSiteMedia } from './siteMediaNext.ts';
import { webPushService } from './webpush.ts';

/** What the Site settings and Birth routes write with: the deployment's push service and media storage. */
export function birthWriteDeps(): BirthWriteDeps {
  return { push: webPushService(), media: deploymentSiteMedia };
}

/**
 * `{ site, notification }` once saved, `{ errors }` with 400 for Site settings
 * errors, and a 409 `staleSite` when the Site changed since the tab read it.
 */
export function birthWriteResponse(result: BirthWrite): NextResponse {
  if (result.ok) {
    return NextResponse.json({ site: toSiteDTO(result.site), notification: result.notification });
  }
  if ('errors' in result) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }
  return result.refused === 'stale'
    ? routeError(409, { code: 'staleSite' })
    : routeError(400, { code: 'invalidRequest' });
}
