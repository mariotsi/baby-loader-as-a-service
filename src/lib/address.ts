/**
 * Where each Site is reached (its Address, see GLOSSARY.md) and, the other
 * way round, which Site a request is for. Pure and free of server imports:
 * the proxy, the Dashboard and the Site settings rules all read it, and the
 * browser can too once the server hands it the configuration.
 */

export type AddressMode = 'subdomain' | 'path';

export type AddressConfig = {
  /** The Platform's host, lowercase, with its port when it has one (`localhost:3100`). */
  rootDomain: string;
  mode: AddressMode;
  protocol: 'http' | 'https';
};

/**
 * Vercel never serves wildcard subdomains under vercel.app, so a preview,
 * whose root domain is its branch URL, serves every Site by path at
 * /sites/<slug>. Everywhere else a Site has a subdomain of its own.
 *
 * Known limit of path mode: every Site shares the Platform's origin, so a
 * browser holds one push Subscription for all of them, and opting in or out
 * on one Site reads the same on the others. Only previews run in path mode.
 */
export function addressConfig(env: Record<string, string | undefined>): AddressConfig {
  const rootDomain = (env.ROOT_DOMAIN || env.VERCEL_BRANCH_URL || 'localhost').toLowerCase();
  const hostname = hostnameOf(rootDomain);
  return {
    rootDomain,
    mode: hostname.endsWith('.vercel.app') ? 'path' : 'subdomain',
    protocol: hostname === 'localhost' ? 'http' : 'https',
  };
}

/** This deployment's configuration. ROOT_DOMAIN is server-only: the browser gets it as data. */
export const ADDRESS_CONFIG = addressConfig(typeof process === 'undefined' ? {} : process.env);

/** A DNS label of 3-32 lowercase letters, digits and inner hyphens: what a subdomain can carry. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

/** Slugs the Platform keeps for its own hosts and paths. */
const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'ftp',
  'root',
  'support',
  'help',
  'blog',
  'status',
  'docs',
  'assets',
  'static',
  'cdn',
  'signup',
  'login',
  'onboarding',
  'billing',
  'account',
  'staging',
]);

/** Why a string cannot be a Slug, or null when it can. */
export function slugProblem(slug: string): 'invalidFormat' | 'slugReserved' | null {
  if (!SLUG_PATTERN.test(slug)) {
    return 'invalidFormat';
  }
  return RESERVED_SLUGS.has(slug) ? 'slugReserved' : null;
}

/** Absolute URL of a Site's Public page. */
export function siteAddress(slug: string, config: AddressConfig = ADDRESS_CONFIG): string {
  return config.mode === 'path'
    ? `${config.protocol}://${config.rootDomain}/sites/${slug}`
    : `${config.protocol}://${slug}.${config.rootDomain}`;
}

/** Path of a Site's Public page, relative to the host that serves it. */
export function siteAddressPath(slug: string, config: AddressConfig = ADDRESS_CONFIG): string {
  return config.mode === 'path' ? `/sites/${slug}` : '/';
}

/**
 * What a request is for:
 * - `site`: served by the route at `internalPath` (/sites/<slug>/...);
 * - `redirect`: a Site reached away from its Address, sent there;
 * - `platform`: the Platform's own pages;
 * - `customDomain`: a host that is neither the root domain nor under it,
 *   served as the Platform until Custom domains exist.
 */
export type Resolution =
  | { kind: 'site'; slug: string; internalPath: string }
  | { kind: 'redirect'; location: string }
  | { kind: 'platform' }
  | { kind: 'customDomain'; host: string };

const SITE_PATH = /^\/sites\/([^/]+)(\/.*)?$/;

/**
 * Resolves a request from its Host header and pathname. A Site is served only
 * at its Address: in subdomain mode, a /sites/<slug> path on any other host
 * redirects to the Site's subdomain, so each Site keeps an origin of its own.
 */
export function resolveRequest(host: string, pathname: string, config: AddressConfig = ADDRESS_CONFIG): Resolution {
  const hostname = hostnameOf(host.toLowerCase());
  const root = hostnameOf(config.rootDomain);
  const sitePath = SITE_PATH.exec(pathname);
  const pathSlug = sitePath && slugProblem(sitePath[1]) !== 'invalidFormat' ? sitePath[1] : null;

  if (config.mode === 'path') {
    return pathSlug ? { kind: 'site', slug: pathSlug, internalPath: pathname } : { kind: 'platform' };
  }

  const isPlatformHost = hostname === root || hostname === `www.${root}` || hostname === 'localhost';
  if (!isPlatformHost && hostname.endsWith(`.${root}`)) {
    const label = hostname.slice(0, -`.${root}`.length);
    // Only a single-level subdomain is a Site; a deeper one falls through to the Platform.
    if (label.includes('.')) {
      return { kind: 'platform' };
    }
    return { kind: 'site', slug: label, internalPath: `/sites/${label}${pathname === '/' ? '' : pathname}` };
  }

  if (pathSlug) {
    return { kind: 'redirect', location: `${siteAddress(pathSlug, config)}${sitePath?.[2] ?? '/'}` };
  }
  return isPlatformHost ? { kind: 'platform' } : { kind: 'customDomain', host: hostname };
}

function hostnameOf(host: string): string {
  return host.split(':')[0];
}
