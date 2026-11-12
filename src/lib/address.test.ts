import { expect, test } from 'vitest';
import {
  type AddressConfig,
  addressConfig,
  isSlug,
  resolveRequest,
  siteAddress,
  siteAddressPath,
  slugProblem,
} from './address.ts';

const PRODUCTION = addressConfig({ ROOT_DOMAIN: 'loading.baby' });
const LOCAL = addressConfig({ ROOT_DOMAIN: 'localhost:3100' });
const PREVIEW = addressConfig({ ROOT_DOMAIN: 'feat-x-loading-baby-staging.example.workers.dev' });
const SLUGS = ['emma', 'emma-rose', 'a1b', 'x'.repeat(32)];

/** What the browser sends for an Address: its Host header and pathname. */
function requestFor(address: string): [string, string] {
  const url = new URL(address);
  return [url.host, url.pathname];
}

test('addressConfig picks the mode and protocol from the root domain', () => {
  expect(PRODUCTION).toStrictEqual({ rootDomain: 'loading.baby', mode: 'subdomain', protocol: 'https' });
  expect(LOCAL).toStrictEqual({ rootDomain: 'localhost:3100', mode: 'subdomain', protocol: 'http' });
  expect(PREVIEW).toStrictEqual({
    rootDomain: 'feat-x-loading-baby-staging.example.workers.dev',
    mode: 'path',
    protocol: 'https',
  });
  expect(addressConfig({})).toStrictEqual({ rootDomain: 'localhost', mode: 'subdomain', protocol: 'http' });
  expect(addressConfig({ ROOT_DOMAIN: 'Loading.Baby' }).rootDomain).toBe('loading.baby');
});

for (const [name, config] of [
  ['production', PRODUCTION],
  ['local', LOCAL],
  ['preview', PREVIEW],
] as [string, AddressConfig][]) {
  test(`every Address resolves back to its Site (${name})`, () => {
    for (const slug of SLUGS) {
      const resolution = resolveRequest(...requestFor(siteAddress(slug, config)), config);
      expect(resolution.kind, `${slug} at ${siteAddress(slug, config)}`).toBe('site');
      expect(resolution.kind === 'site' && resolution.slug).toBe(slug);
    }
  });
}

test('Addresses are subdomains, or paths on a preview', () => {
  expect(siteAddress('emma', PRODUCTION)).toBe('https://emma.loading.baby');
  expect(siteAddress('emma', LOCAL)).toBe('http://emma.localhost:3100');
  expect(siteAddress('emma', PREVIEW)).toBe('https://feat-x-loading-baby-staging.example.workers.dev/sites/emma');
  expect(siteAddressPath('emma', PRODUCTION)).toBe('/');
  expect(siteAddressPath('emma', PREVIEW)).toBe('/sites/emma');
});

test('a Site on its subdomain is served by the /sites route, keeping the rest of the path', () => {
  expect(resolveRequest('emma.loading.baby', '/', PRODUCTION)).toStrictEqual({
    kind: 'site',
    slug: 'emma',
    internalPath: '/sites/emma',
  });
  expect(resolveRequest('Emma.Loading.Baby', '/icon.png', PRODUCTION)).toStrictEqual({
    kind: 'site',
    slug: 'emma',
    internalPath: '/sites/emma/icon.png',
  });
  expect(resolveRequest('emma.localhost:3100', '/', LOCAL)).toStrictEqual({
    kind: 'site',
    slug: 'emma',
    internalPath: '/sites/emma',
  });
});

test("a /sites path away from the Site's subdomain redirects to its Address", () => {
  expect(resolveRequest('loading.baby', '/sites/emma', PRODUCTION)).toStrictEqual({
    kind: 'redirect',
    location: 'https://emma.loading.baby/',
  });
  expect(resolveRequest('loading-baby.example.workers.dev', '/sites/emma/icon.png', PRODUCTION)).toStrictEqual({
    kind: 'redirect',
    location: 'https://emma.loading.baby/icon.png',
  });
  expect(resolveRequest('localhost:3100', '/sites/emma', LOCAL)).toStrictEqual({
    kind: 'redirect',
    location: 'http://emma.localhost:3100/',
  });
  // Not a Slug: left to the route, which answers 404.
  expect(resolveRequest('loading.baby', '/sites/Not_A_Slug', PRODUCTION)).toStrictEqual({ kind: 'platform' });
});

test('the root domain, www and localhost serve the Platform', () => {
  for (const host of ['loading.baby', 'www.loading.baby', 'localhost:3000', 'loading.baby:443']) {
    expect(resolveRequest(host, '/dashboard', PRODUCTION), host).toStrictEqual({ kind: 'platform' });
  }
  expect(resolveRequest('a.b.loading.baby', '/', PRODUCTION)).toStrictEqual({ kind: 'platform' });
});

test('any other host is a candidate Custom domain', () => {
  expect(resolveRequest('Baby.Example.com', '/', PRODUCTION)).toStrictEqual({
    kind: 'customDomain',
    host: 'baby.example.com',
  });
  expect(resolveRequest('loading.baby.evil.com', '/', PRODUCTION)).toStrictEqual({
    kind: 'customDomain',
    host: 'loading.baby.evil.com',
  });
});

test('on a preview, Sites are paths and everything else is the Platform', () => {
  const host = 'feat-x-loading-baby-staging.example.workers.dev';
  expect(resolveRequest(host, '/sites/emma', PREVIEW)).toStrictEqual({
    kind: 'site',
    slug: 'emma',
    internalPath: '/sites/emma',
  });
  expect(resolveRequest(host, '/dashboard', PREVIEW)).toStrictEqual({ kind: 'platform' });
  expect(resolveRequest('abc123-loading-baby-staging.example.workers.dev', '/', PREVIEW)).toStrictEqual({
    kind: 'platform',
  });
});

test('slugProblem rejects what a subdomain cannot carry and what the Platform keeps', () => {
  expect(slugProblem('emma')).toBe(null);
  expect(slugProblem('ab')).toBe('invalidFormat');
  expect(slugProblem('-emma')).toBe('invalidFormat');
  expect(slugProblem('emma-')).toBe('invalidFormat');
  expect(slugProblem('Emma')).toBe('invalidFormat');
  expect(slugProblem('x'.repeat(33))).toBe('invalidFormat');
  expect(slugProblem('www')).toBe('slugReserved');
  expect(slugProblem('staging')).toBe('slugReserved');
  expect(slugProblem('admin')).toBe('slugReserved');
  expect(slugProblem('dashboard')).toBe('slugReserved');
});

test('isSlug takes what slugProblem accepts and nothing else', () => {
  expect(isSlug('emma')).toBe(true);
  for (const value of [undefined, 42, 'ab', '-emma', 'Emma', 'www', 'dashboard']) {
    expect(isSlug(value), String(value)).toBe(false);
  }
});
