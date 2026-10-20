import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { BASE_URL, bypassHeaders, ownerStatePath } from './support/env.ts';
import { expect, test } from './support/test.ts';

/** A Site of Owner A that Owner B tries to reach. */
const A_SITE = 'e2e-waiting';

// Server-side checks: one browser covers them.
test.skip(({ browserName }) => browserName !== 'chromium', 'server-side authorization, checked once');

test.describe('Owner B, logged in', () => {
  test.use({ storageState: ownerStatePath('b') });

  test('does not see Owner A’s Sites in the Dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('Beatrice', { exact: true })).toBeVisible();
    await expect(page.getByText('Wanda', { exact: true })).toHaveCount(0);
  });

  for (const path of [`/admin/${A_SITE}`, `/admin/${A_SITE}/subscriptions`, `/admin/${A_SITE}/send`]) {
    test(`gets 404 for ${path.replace(A_SITE, '<A’s Site>')}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    });
  }

  test.describe('through the API', () => {
    let api: APIRequestContext;
    test.beforeAll(async () => {
      api = await playwrightRequest.newContext({
        baseURL: BASE_URL,
        storageState: ownerStatePath('b'),
        extraHTTPHeaders: bypassHeaders(),
      });
    });
    test.afterAll(async () => api.dispose());

    test('cannot read or change Owner A’s Site settings', async () => {
      expect((await api.get(`/api/tenants/${A_SITE}`)).status()).toBe(403);
      expect((await api.patch(`/api/tenants/${A_SITE}`, { data: { babyName: 'Taken over' } })).status()).toBe(403);
    });

    test('cannot count or notify Owner A’s Subscribers', async () => {
      expect((await api.get(`/api/send-notification?tenantSlug=${A_SITE}`)).status()).toBe(403);
      const send = await api.post('/api/send-notification', { data: { tenantSlug: A_SITE, body: 'Hello from B' } });
      expect(send.status()).toBe(403);
    });
  });
});

test.describe('without a session', () => {
  test('the Dashboard sends to the login page', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('the API answers 401', async () => {
    const api = await playwrightRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: bypassHeaders() });
    try {
      expect((await api.get('/api/tenants')).status()).toBe(401);
      expect((await api.get(`/api/tenants/${A_SITE}`)).status()).toBe(401);
      expect((await api.post('/api/send-notification', { data: { tenantSlug: A_SITE, body: 'x' } })).status()).toBe(401);
    } finally {
      await api.dispose();
    }
  });
});
