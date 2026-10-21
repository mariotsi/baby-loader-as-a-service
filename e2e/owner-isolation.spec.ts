import { type APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { defaultSiteSettings } from '../src/lib/siteSettings.ts';
import { BASE_URL, bypassHeaders, ownerStatePath } from './support/env.ts';
import { expect, test } from './support/test.ts';

/** A Site of Owner A that Owner B tries to reach. */
const A_SITE = 'e2e-waiting';

test.describe('Owner B, logged in', () => {
  test.use({ storageState: ownerStatePath('b') });

  test('does not see Owner A’s Sites in the Dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('Beatrice', { exact: true })).toBeVisible();
    await expect(page.getByText('Wanda', { exact: true })).toHaveCount(0);
  });

  for (const path of [`/admin/${A_SITE}`, `/admin/${A_SITE}/subscriptions`, `/admin/${A_SITE}/send`]) {
    test(`gets the 404 page for ${path.replace(A_SITE, '<A’s Site>')}`, async ({ page }) => {
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

    // Another Owner's Site answers as if it did not exist: 404, never 403.
    test('cannot read or change Owner A’s Site settings', async () => {
      expect((await api.get(`/api/sites/${A_SITE}`)).status()).toBe(404);
      const put = await api.put(`/api/sites/${A_SITE}`, { data: { ...defaultSiteSettings, babyName: 'Taken over' } });
      expect(put.status()).toBe(404);
    });

    test('cannot count or notify Owner A’s Subscribers', async () => {
      expect((await api.get(`/api/send-notification?slug=${A_SITE}`)).status()).toBe(404);
      const send = await api.post('/api/send-notification', { data: { slug: A_SITE, body: 'Hello from B' } });
      expect(send.status()).toBe(404);
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
      expect((await api.get('/api/sites')).status()).toBe(401);
      expect((await api.get(`/api/sites/${A_SITE}`)).status()).toBe(401);
      expect((await api.post('/api/send-notification', { data: { slug: A_SITE, body: 'x' } })).status()).toBe(401);
    } finally {
      await api.dispose();
    }
  });
});
