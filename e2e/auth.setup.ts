import { FIXTURE_OWNERS, type Owner } from './support/data.ts';
import { e2ePassword, ownerStatePath } from './support/env.ts';
import { expect, test } from './support/test.ts';

/**
 * Logs each fixture Owner in once per run and saves the session for every
 * test: login and signup share a limit of 10 attempts a minute per IP.
 */
for (const owner of ['a', 'b'] as Owner[]) {
  test(`log in fixture Owner ${owner}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(FIXTURE_OWNERS[owner]);
    await page.getByLabel('Password').fill(e2ePassword());
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.context().storageState({ path: ownerStatePath(owner) });
  });
}
