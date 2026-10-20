import type { Page } from '@playwright/test';
import { FIXTURE_OWNERS, runEmail, runSlug } from './support/data.ts';
import { bypassHeaders, e2ePassword, runId } from './support/env.ts';
import { dashboardAddress, expect, test } from './support/test.ts';

// Login and signup share a limit of 10 attempts a minute per IP, so these run
// in one browser only; the forms are server-rendered the same everywhere.
test.skip(({ browserName }) => browserName !== 'chromium', 'rate-limited auth endpoints, checked once');

async function createSite(page: Page, slug: string, babyName: string) {
  await page.goto('/onboarding');
  await page.getByLabel('Site address').fill(slug);
  await page.getByLabel("Baby's name").fill(babyName);
  await page.getByLabel('Due date').fill('2026-12-24');
  await page.getByRole('button', { name: 'Create site' }).click();
}

test('a new User signs up and creates several Sites', async ({ page }, testInfo) => {
  // A retry signs up anew: the first attempt's User and Sites still exist.
  const attempt = `${testInfo.retry}${testInfo.repeatEachIndex}`;
  const first = runSlug(runId(), `first${attempt}`);
  const second = runSlug(runId(), `second${attempt}`);

  await page.goto('/signup');
  await page.getByLabel('Email').fill(runEmail(runId(), `signup${attempt}`));
  await page.getByLabel('Password').fill('a-brand-new-password');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await createSite(page, first, 'Ada');
  await expect(page).toHaveURL(new RegExp(`/admin/${first}$`));
  await createSite(page, second, 'Otto');
  await expect(page).toHaveURL(new RegExp(`/admin/${second}$`));

  await createSite(page, first, 'Copycat');
  await expect(page.getByText('Site address is already taken.')).toBeVisible();
  await createSite(page, 'staging', 'Sneaky');
  await expect(page.getByText('Site address is reserved.')).toBeVisible();

  await page.goto('/admin');
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
  await expect(page.getByText('Otto', { exact: true })).toBeVisible();
  await expect(page.getByText('Copycat', { exact: true })).toHaveCount(0);

  await page.goto(await dashboardAddress(page, first));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for Ada');
});

test('login refuses a wrong password and logout ends the session', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(FIXTURE_OWNERS.b);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Invalid email or password.')).toBeVisible();

  await page.getByLabel('Password').fill(e2ePassword());
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // The UI has no logout control yet; the endpoint ends the session.
  await page.request.post('/api/auth/logout', { headers: bypassHeaders() });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});
