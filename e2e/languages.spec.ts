import { perProjectSlug } from './support/data.ts';
import { ownerStatePath } from './support/env.ts';
import { expect, test } from './support/test.ts';

test.describe('Platform pages for an Italian browser', () => {
  test.use({ locale: 'it-IT' });

  test('open in Italian, and switch to English for the next visits too', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accedi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');

    await page.getByRole('radio', { name: 'English' }).check();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Log in');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.goto('/signup');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create your account');
  });

  test.describe('signed in', () => {
    test.use({ storageState: ownerStatePath('a') });

    test('explain a Site settings error in Italian', async ({ page, project }) => {
      await page.goto(`/dashboard/${perProjectSlug('e2e-rules', project)}`);
      await page.getByRole('button', { name: 'Annuncia la nascita' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Data e ora di nascita').fill('');
      await dialog.getByRole('button', { name: 'Annuncia la nascita' }).click();
      await expect(dialog.getByText('Data e ora di nascita: campo obbligatorio.', { exact: true })).toBeVisible();
    });
  });
});
