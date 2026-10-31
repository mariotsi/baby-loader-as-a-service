import type { Page } from '@playwright/test';
import { hashPassword, PASSWORD_GENERATIONS } from '../src/lib/password.ts';
import { signSessionToken } from '../src/lib/sessionToken.ts';
import { defaultSiteSettings } from '../src/lib/siteSettings.ts';
import { FIXTURE_OWNERS, PASSWORD_USERS, runEmail, runSlug } from './support/data.ts';
import { setPasswordHash, storedPasswordHash } from './support/db.ts';
import { BASE_URL, bypassHeaders, e2ePassword, runId, sessionSecret } from './support/env.ts';
import { dashboardAddress, expect, test } from './support/test.ts';

async function fillBasics(page: Page, slug: string, babyName: string) {
  await page.goto('/onboarding');
  await page.getByLabel('Site address').fill(slug);
  await page.getByLabel("Baby's name").fill(babyName);
  await page.getByLabel('Due date').fill('2026-12-24');
  await page.getByRole('button', { name: 'Next' }).click();
}

/** From the second step to the last, then Create. */
async function finishSite(page: Page) {
  await expect(page.getByRole('heading', { name: 'Make it yours' })).toBeFocused();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Who sees what' })).toBeFocused();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'A last look' })).toBeFocused();
  await page.getByRole('button', { name: 'Create site' }).click();
}

async function createSite(page: Page, slug: string, babyName: string) {
  await fillBasics(page, slug, babyName);
  await finishSite(page);
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

  // Leaving The basics already says a Slug is taken or reserved, so no Site is created.
  await fillBasics(page, first, 'Copycat');
  await expect(page.getByText('Site address is already taken.')).toBeVisible();
  await expect(page.getByLabel('Site address')).toBeFocused();
  await fillBasics(page, 'staging', 'Sneaky');
  await expect(page.getByText('This address is reserved.')).toBeVisible();

  // Someone can take the Slug after the check: creating brings the Owner back to the field.
  await page.route('**/api/slug-available*', (route) => route.fulfill({ json: { available: true } }));
  await fillBasics(page, first, 'Copycat');
  await finishSite(page);
  await expect(page.getByText('Site address is already taken.')).toBeVisible();
  await expect(page.getByLabel('Site address')).toBeFocused();
  await page.unroute('**/api/slug-available*');

  await page.goto('/dashboard');
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
  await expect(page.getByText('Otto', { exact: true })).toBeVisible();
  await expect(page.getByText('Copycat', { exact: true })).toHaveCount(0);

  await page.goto(await dashboardAddress(page, first));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for Ada');
});

test('creating a Site keeps its steps in the history, survives a reload and greets the Owner', async ({
  page,
}, testInfo) => {
  const attempt = `${testInfo.retry}${testInfo.repeatEachIndex}`;
  const slug = runSlug(runId(), `steps${attempt}`);
  await page.goto('/signup');
  await page.getByLabel('Email').fill(runEmail(runId(), `steps${attempt}`));
  await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Write the baby’s name, or a nickname for now.')).toBeVisible();
  await expect(page.getByLabel('Site address')).toBeFocused();

  await fillBasics(page, slug, 'Ada');
  await expect(page.getByRole('heading', { name: 'Make it yours' })).toBeFocused();
  await expect(page.getByRole('listitem').and(page.locator('[aria-current="step"]'))).toHaveText('Make it yours');

  await page.goBack();
  await expect(page.getByLabel('Site address')).toHaveValue(slug);
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Make it yours' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Make it yours' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel("Baby's name")).toHaveValue('Ada');
  await page.getByRole('button', { name: 'Next' }).click();

  await finishSite(page);
  await expect(page).toHaveURL(new RegExp(`/dashboard/${slug}$`));
  await expect(page.getByText(/^Your page is live at /)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/^Your page is live at /)).toBeHidden();
});

test('the API refuses a new Site that is already born', async ({ page }, testInfo) => {
  const attempt = `${testInfo.retry}${testInfo.repeatEachIndex}`;
  await page.goto('/signup');
  await page.getByLabel('Email').fill(runEmail(runId(), `born${attempt}`));
  await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  const res = await page.request.post('/api/sites', {
    headers: bypassHeaders(),
    data: {
      slug: runSlug(runId(), `born${attempt}`),
      settings: {
        ...defaultSiteSettings,
        babyName: 'Ada',
        sex: 'female',
        birth: {
          born: true,
          details: { datetime: '2026-01-01T08:00:00.000Z', weightGrams: null, lengthCm: null, message: {} },
        },
      },
    },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).errors).toEqual([{ path: 'settings.birth', code: 'invalidOption' }]);
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

test('a User whose password hash is generation 1 logs in, and the hash becomes generation 2', async ({ page }) => {
  const { email } = PASSWORD_USERS.legacy;
  const generationOne = PASSWORD_GENERATIONS.find((g) => g.id === 1);
  if (!generationOne) {
    throw new Error('No password generation 1');
  }
  await setPasswordHash(email, await hashPassword(e2ePassword(), generationOne));
  expect(await storedPasswordHash(email)).toMatch(/^scrypt\$65536\$8\$2\$/);

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(e2ePassword());
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await storedPasswordHash(email)).toMatch(/^v2\$scrypt\$16384\$8\$5\$/);
});

test('a session with a password change pending reaches the Dashboard only after a new password', async ({
  page,
  context,
}) => {
  // A login sets the pending mark only for a generation with policy change, and none has one, so the
  // test signs the session itself, with the local server's secret: the only one the suite knows.
  const secret = sessionSecret();
  test.skip(!secret, 'Signing a session needs the SESSION_SECRET of the local server');
  const { email, id } = PASSWORD_USERS.pending;
  const token = signSessionToken({ userId: id, passwordChangePending: true }, Date.now() + 60_000, secret ?? '');
  await context.addCookies([{ name: 'session', value: token, url: BASE_URL }]);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/account\/password$/);
  await expect(page.getByText('Your password needs an update.', { exact: false })).toBeVisible();
  await page.goto('/dashboard/e2e-waiting');
  await expect(page).toHaveURL(/\/account\/password$/);

  const before = await storedPasswordHash(email);
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your sites' })).toBeVisible();

  const after = await storedPasswordHash(email);
  expect(after).toMatch(/^v2\$scrypt\$16384\$8\$5\$/);
  expect(after).not.toEqual(before);
});
