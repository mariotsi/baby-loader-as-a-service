/**
 * The host the Platform is served on, with each Site's Address under it.
 * A Vercel preview deployment leaves ROOT_DOMAIN unset and uses its branch
 * URL, a vercel.app host, so the preview serves Sites by path. Locally it may
 * carry a port (`localhost:3100`), which Addresses keep.
 */
export const ROOT_DOMAIN = (process.env.ROOT_DOMAIN || process.env.VERCEL_BRANCH_URL || 'localhost').toLowerCase();

/** ROOT_DOMAIN without its port: what a request's hostname is compared with. */
export const ROOT_HOSTNAME = ROOT_DOMAIN.split(':')[0];

/**
 * Vercel never serves wildcard subdomains under vercel.app, so on such a root
 * domain every tenant lives at /sites/<slug> on the root host. Everywhere
 * else a tenant gets its own subdomain, which middleware rewrites to the same
 * /sites/<slug> route.
 */
export const usesSubdomains = !ROOT_HOSTNAME.endsWith('.vercel.app');

/** Absolute URL of a tenant's public page. */
export function tenantPublicUrl(slug: string): string {
  if (!usesSubdomains) {
    return `https://${ROOT_DOMAIN}/sites/${slug}`;
  }
  const protocol = ROOT_HOSTNAME === 'localhost' ? 'http' : 'https';
  return `${protocol}://${slug}.${ROOT_DOMAIN}`;
}

/** Path of a tenant's public page, relative to the host that serves it. */
export function tenantPublicPath(slug: string): string {
  return usesSubdomains ? '/' : `/sites/${slug}`;
}
