import type { Page } from '@playwright/test';
import { FIXTURE_OWNERS, runEmail, runSlug } from './support/data.ts';
import { bypassHeaders, e2ePassword, runId } from './support/env.ts';
import { dashboardAddress, expect, test } from './support/test.ts';

async function createSite(page: Page, slug: string, babyName: string) {
  await page.goto('/onboarding');
  await page.getByLabel('Site address').fill(slug);
  await page.getByLabel("Baby's name").fill(babyName);
  await page.getByLabel('Due date').fill('2026-12-24');
  await page.getByRole('button', { name: 'Create site' }).click();
}

/** Meets every rule in src/lib/passwordRules.ts. */
const NEW_PASSWORD = 'A-brand-new-passw0rd';

test('signup sends nothing until the password meets every rule and is typed twice the same', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/auth/signup')) {
      requests.push(req.url());
    }
  });
  await page.goto('/signup');
  await page.getByLabel('Email').fill(runEmail(runId(), 'rules'));
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('abcdefghij1');
  await page.getByLabel('Confirm password').fill('something else');
  await page.getByRole('button', { name: 'Sign up' }).click();

  // The rules list shows what is missing; screen readers also hear it in the field's description.
  await expect(password).toHaveAccessibleDescription(/Not met yet: An uppercase letter, A symbol/);
  await expect(page.getByText("The passwords don't match. Type the same password again.")).toBeVisible();
  await expect(password).toBeFocused();
  await expect(page.getByRole('listitem').filter({ hasText: 'An uppercase letter' })).toContainText('not yet');
  await expect(page.getByRole('listitem').filter({ hasText: 'A number' })).toContainText('done');

  // Fixing the password leaves only the confirmation in the way.
  await password.fill(NEW_PASSWORD);
  await expect(password).not.toHaveAccessibleDescription(/Not met yet/);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByLabel('Confirm password')).toBeFocused();
  await expect(page).toHaveURL(/\/signup$/);
  expect(requests).toEqual([]);
});

test('signup takes a password that a password manager fills without telling the page', async ({ page }) => {
  // Some managers set a field's value without an input event, so the form only learns of it on blur or submit.
  const fillSilently = (label: string, value: string) =>
    page.getByLabel(label, { exact: true }).evaluate((input, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, v);
    }, value);

  await page.goto('/signup');
  await page.getByLabel('Email').fill(runEmail(runId(), 'manager'));
  await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm password').fill('mistyped');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByText("The passwords don't match. Type the same password again.")).toBeVisible();

  await fillSilently('Confirm password', NEW_PASSWORD);
  await page.getByLabel('Email').focus();
  await expect(page.getByText("The passwords don't match. Type the same password again.")).toHaveCount(0);

  await fillSilently('Password', `${NEW_PASSWORD}x`);
  await fillSilently('Confirm password', `${NEW_PASSWORD}x`);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('a new User signs up and creates several Sites', async ({ page }, testInfo) => {
  // A retry signs up anew: the first attempt's User and Sites still exist.
  const attempt = `${testInfo.retry}${testInfo.repeatEachIndex}`;
  const first = runSlug(runId(), `first${attempt}`);
  const second = runSlug(runId(), `second${attempt}`);

  await page.goto('/signup');
  await page.getByLabel('Email').fill(runEmail(runId(), `signup${attempt}`));
  await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await createSite(page, first, 'Ada');
  await expect(page).toHaveURL(new RegExp(`/dashboard/${first}$`));
  await createSite(page, second, 'Otto');
  await expect(page).toHaveURL(new RegExp(`/dashboard/${second}$`));

  await createSite(page, first, 'Copycat');
  await expect(page.getByText('Site address is already taken.')).toBeVisible();
  await createSite(page, 'staging', 'Sneaky');
  await expect(page.getByText('Site address is reserved.')).toBeVisible();

  await page.goto('/dashboard');
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
  await expect(page).toHaveURL(/\/dashboard$/);

  // The UI has no logout control yet; the endpoint ends the session.
  await page.request.post('/api/auth/logout', { headers: bypassHeaders() });
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
