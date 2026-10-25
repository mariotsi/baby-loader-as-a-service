import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type AddressConfig,
  addressConfig,
  resolveRequest,
  siteAddress,
  siteAddressPath,
  slugProblem,
} from './address.ts';

const PRODUCTION = addressConfig({ ROOT_DOMAIN: 'loading.baby' });
const LOCAL = addressConfig({ ROOT_DOMAIN: 'localhost:3100' });
const PREVIEW = addressConfig({ VERCEL_BRANCH_URL: 'baby-loader-git-feat-x.vercel.app' });
const SLUGS = ['emma', 'emma-rose', 'a1b', 'x'.repeat(32)];

/** What the browser sends for an Address: its Host header and pathname. */
function requestFor(address: string): [string, string] {
  const url = new URL(address);
  return [url.host, url.pathname];
}

test('addressConfig picks the mode and protocol from the root domain', () => {
  assert.deepEqual(PRODUCTION, { rootDomain: 'loading.baby', mode: 'subdomain', protocol: 'https' });
  assert.deepEqual(LOCAL, { rootDomain: 'localhost:3100', mode: 'subdomain', protocol: 'http' });
  assert.deepEqual(PREVIEW, { rootDomain: 'baby-loader-git-feat-x.vercel.app', mode: 'path', protocol: 'https' });
  assert.deepEqual(addressConfig({}), { rootDomain: 'localhost', mode: 'subdomain', protocol: 'http' });
  assert.equal(
    addressConfig({ ROOT_DOMAIN: 'Loading.Baby', VERCEL_BRANCH_URL: 'x.vercel.app' }).rootDomain,
    'loading.baby'
  );
});

for (const [name, config] of [
  ['production', PRODUCTION],
  ['local', LOCAL],
  ['preview', PREVIEW],
] as [string, AddressConfig][]) {
  test(`every Address resolves back to its Site (${name})`, () => {
    for (const slug of SLUGS) {
      const resolution = resolveRequest(...requestFor(siteAddress(slug, config)), config);
      assert.equal(resolution.kind, 'site', `${slug} at ${siteAddress(slug, config)}`);
      assert.equal(resolution.kind === 'site' && resolution.slug, slug);
    }
  });
}

test('Addresses are subdomains, or paths on a preview', () => {
  assert.equal(siteAddress('emma', PRODUCTION), 'https://emma.loading.baby');
  assert.equal(siteAddress('emma', LOCAL), 'http://emma.localhost:3100');
  assert.equal(siteAddress('emma', PREVIEW), 'https://baby-loader-git-feat-x.vercel.app/sites/emma');
  assert.equal(siteAddressPath('emma', PRODUCTION), '/');
  assert.equal(siteAddressPath('emma', PREVIEW), '/sites/emma');
});

test('a Site on its subdomain is served by the /sites route, keeping the rest of the path', () => {
  assert.deepEqual(resolveRequest('emma.loading.baby', '/', PRODUCTION), {
    kind: 'site',
    slug: 'emma',
    internalPath: '/sites/emma',
  });
  assert.deepEqual(resolveRequest('Emma.Loading.Baby', '/icon.png', PRODUCTION), {
    kind: 'site',
    slug: 'emma',
    internalPath: '/sites/emma/icon.png',
  });
  assert.deepEqual(resolveRequest('emma.localhost:3100', '/', LOCAL), {
    kind: 'site',
    slug: 'emma',
    internalPath: '/sites/emma',
  });
});

test("a /sites path away from the Site's subdomain redirects to its Address", () => {
  assert.deepEqual(resolveRequest('loading.baby', '/sites/emma', PRODUCTION), {
    kind: 'redirect',
    location: 'https://emma.loading.baby/',
  });
  assert.deepEqual(resolveRequest('baby-loader-as-a-service.vercel.app', '/sites/emma/icon.png', PRODUCTION), {
    kind: 'redirect',
    location: 'https://emma.loading.baby/icon.png',
  });
  assert.deepEqual(resolveRequest('localhost:3100', '/sites/emma', LOCAL), {
    kind: 'redirect',
    location: 'http://emma.localhost:3100/',
  });
  // Not a Slug: left to the route, which answers 404.
  assert.deepEqual(resolveRequest('loading.baby', '/sites/Not_A_Slug', PRODUCTION), { kind: 'platform' });
});

test('the root domain, www and localhost serve the Platform', () => {
  for (const host of ['loading.baby', 'www.loading.baby', 'localhost:3000', 'loading.baby:443']) {
    assert.deepEqual(resolveRequest(host, '/dashboard', PRODUCTION), { kind: 'platform' }, host);
  }
  assert.deepEqual(resolveRequest('a.b.loading.baby', '/', PRODUCTION), { kind: 'platform' });
});

test('any other host is a candidate Custom domain', () => {
  assert.deepEqual(resolveRequest('Baby.Example.com', '/', PRODUCTION), {
    kind: 'customDomain',
    host: 'baby.example.com',
  });
  assert.deepEqual(resolveRequest('loading.baby.evil.com', '/', PRODUCTION), {
    kind: 'customDomain',
    host: 'loading.baby.evil.com',
  });
});

test('on a preview, Sites are paths and everything else is the Platform', () => {
  const host = 'baby-loader-git-feat-x.vercel.app';
  assert.deepEqual(resolveRequest(host, '/sites/emma', PREVIEW), {
    kind: 'site',
    slug: 'emma',
    internalPath: '/sites/emma',
  });
  assert.deepEqual(resolveRequest(host, '/dashboard', PREVIEW), { kind: 'platform' });
  assert.deepEqual(resolveRequest('baby-loader-abc123.vercel.app', '/', PREVIEW), { kind: 'platform' });
});

test('slugProblem rejects what a subdomain cannot carry and what the Platform keeps', () => {
  assert.equal(slugProblem('emma'), null);
  assert.equal(slugProblem('ab'), 'invalidFormat');
  assert.equal(slugProblem('-emma'), 'invalidFormat');
  assert.equal(slugProblem('emma-'), 'invalidFormat');
  assert.equal(slugProblem('Emma'), 'invalidFormat');
  assert.equal(slugProblem('x'.repeat(33)), 'invalidFormat');
  assert.equal(slugProblem('www'), 'slugReserved');
  assert.equal(slugProblem('staging'), 'slugReserved');
  assert.equal(slugProblem('admin'), 'slugReserved');
  assert.equal(slugProblem('dashboard'), 'slugReserved');
});
