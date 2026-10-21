import { type NextRequest, NextResponse } from 'next/server';
import { ROOT_HOSTNAME } from '@/lib/address';

/**
 * Resolves which Site (if any) a request's Host header maps to, and
 * rewrites it to the internal `/sites/[slug]` route. This is the one place
 * in the app that turns "which URL was this?" into "which Site is this?" —
 * every other route either doesn't need a Site (marketing, auth, admin) or
 * receives the slug explicitly (admin/[slug]/...).
 *
 * Deliberately does NOT query the database here: middleware performance
 * matters on every request, and a missing/unknown slug is cheap to detect
 * and 404 inside the page itself. This also sidesteps the Node-vs-Edge
 * runtime question for the MongoDB driver — middleware here stays a pure
 * string operation.
 */

function stripPort(host: string): string {
  return host.split(':')[0];
}

function resolveSlug(host: string): string | null {
  const hostname = stripPort(host.toLowerCase());

  if (hostname === ROOT_HOSTNAME || hostname === `www.${ROOT_HOSTNAME}` || hostname === 'localhost') {
    return null;
  }

  if (hostname.endsWith(`.${ROOT_HOSTNAME}`)) {
    const sub = hostname.slice(0, -(`.${ROOT_HOSTNAME}`.length));
    // Only a single level of subdomain is a Slug; anything else
    // (unexpected multi-level host) falls through to the root app.
    return sub && !sub.includes('.') ? sub : null;
  }

  // Any other host is treated as a candidate custom domain. Custom-domain
  // support (plan phase 7) isn't built yet, so for now this just serves the
  // root app rather than 404ing outright.
  return null;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const slug = resolveSlug(host);

  if (!slug) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/sites/${slug}${req.nextUrl.pathname === '/' ? '' : req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    /*
     * Skip Next internals, API routes, and static files — none of these are
     * ever a Site's Public page.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|icon-.*\\.png).*)',
  ],
};
