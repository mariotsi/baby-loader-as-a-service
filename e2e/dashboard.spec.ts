import { perProjectSlug } from './support/data.ts';
import { ownerStatePath } from './support/env.ts';
import { dashboardAddress, expect, test } from './support/test.ts';

test.use({ storageState: ownerStatePath('a') });

test.describe('Dashboard', () => {
  test('lists the Owner’s Sites with their Addresses', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Your sites' })).toBeVisible();
    for (const name of ['Wanda', 'Bruno', 'Bianca']) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    expect(await dashboardAddress(page, 'e2e-waiting')).toMatch(/e2e-waiting/);
  });

  test('saves Site settings and marks the baby as born', async ({ page, project }) => {
    const slug = perProjectSlug('e2e-edit', project);
    await page.goto(`/admin/${slug}`);

    await page.getByLabel('Name', { exact: true }).fill('Edith Rose');
    await page.getByLabel('Sex', { exact: true }).selectOption('female');
    await page.getByLabel('The baby has been born').check();
    await page.getByLabel('Birth date & time').fill('2026-01-15T08:30');
    await page.getByLabel('Weight (g)').fill('3100');
    await page.getByLabel('Length (cm)').fill('49');
    await page.getByRole('button', { name: '+ Add milestone' }).click();
    await page.getByLabel('Milestone 1 label').fill('Coming home');
    await page.getByLabel('Milestone 1 date').fill('2026-01-18');
    await page.getByLabel('Language', { exact: true }).selectOption('it');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Edith Rose');
    await expect(page.getByLabel('The baby has been born')).toBeChecked();
    await expect(page.getByLabel('Weight (g)')).toHaveValue('3100');
    await expect(page.getByLabel('Milestone 1 label')).toHaveValue('Coming home');
    await expect(page.getByLabel('Language', { exact: true })).toHaveValue('it');

    await page.goto(await dashboardAddress(page, slug));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Benvenuto/a Edith Rose');
    await expect(page.getByText('Peso: 3100 g')).toBeVisible();
    await expect(page.getByText('È una femmina')).toBeVisible();
  });
});
