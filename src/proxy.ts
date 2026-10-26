import { type NextRequest, NextResponse } from 'next/server';
import { resolveRequest } from '@/lib/address';
import { addressEnv } from '@/lib/env';

/**
 * Sends each request where Address (src/lib/address.ts) says it belongs: a
 * Site's subdomain is rewritten to its internal /sites/<slug> route, a Site
 * reached away from its Address is redirected there, and everything else is
 * the Platform. No database query: Custom domains are served as the Platform
 * until they exist.
 */
export function proxy(req: NextRequest) {
  const resolution = resolveRequest(req.headers.get('host') ?? '', req.nextUrl.pathname, addressEnv());

  if (resolution.kind === 'redirect') {
    const location = new URL(resolution.location);
    location.search = req.nextUrl.search;
    return NextResponse.redirect(location, 308);
  }
  if (resolution.kind === 'site' && resolution.internalPath !== req.nextUrl.pathname) {
    const url = req.nextUrl.clone();
    url.pathname = resolution.internalPath;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Skip Next internals, API routes, and static files — none of these are
     * ever a Site's Public page. The Platform's icons and manifest are among
     * them, so a Site's subdomain serves them as they are, for the loading
     * baby. A Site's own icons, manifest and share image use other paths
     * (SITE_PATHS in siteMeta.ts), which reach its /sites/<slug> routes.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|sw.js|icon-.*\\.png).*)',
  ],
};
