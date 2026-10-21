import { BASE_URL } from './support/env.ts';
import { expect, test } from './support/test.ts';

test.describe('Public page', () => {
  test('in the Waiting state leads with the Countdown', async ({ page, addressOf }) => {
    await page.goto(await addressOf('e2e-waiting'));

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for Wanda');
    await expect(page.getByText('It’s a girl')).toBeVisible();
    await expect(page.getByText(/^Due date:/)).toBeVisible();
    await expect(page.locator('.countdown')).toHaveText(/^\d+ days to go$/);
  });

  test('in the Born state leads with the Birth details', async ({ page, addressOf }) => {
    await page.goto(await addressOf('e2e-born'));

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome Bruno');
    await expect(page.getByText(/^Born on /)).toBeVisible();
    await expect(page.getByText('Weight: 3250 g')).toBeVisible();
    await expect(page.getByText('Length: 50 cm')).toBeVisible();
    await expect(page.locator('.countdown')).toHaveCount(0);
  });

  test('hides the name and Sex when Privacy settings say so', async ({ page, addressOf }) => {
    await page.goto(await addressOf('e2e-private'));

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for someone');
    await expect(page.getByText('Priscilla')).toHaveCount(0);
    await expect(page.getByText('It’s a girl')).toHaveCount(0);
  });

  test('in Both mode follows the Visitor’s language and the Language switcher', async ({ page, addressOf }) => {
    await page.goto(await addressOf('e2e-both'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for Bianca');

    // Switching swaps the view in place: a marker set before the click survives it.
    await page.evaluate(() => {
      (window as { stillHere?: boolean }).stillHere = true;
    });
    await page.getByRole('button', { name: 'it', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stiamo aspettando Bianca');
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    expect(await page.evaluate(() => (window as { stillHere?: boolean }).stillHere)).toBe(true);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stiamo aspettando Bianca');
  });

  test.describe('for an Italian browser', () => {
    test.use({ locale: 'it-IT' });

    test('in Both mode opens in Italian', async ({ page, addressOf }) => {
      await page.goto(await addressOf('e2e-both'));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stiamo aspettando Bianca');
    });
  });

  test('reached at /sites/<slug> on the Platform, redirects to its Address', async ({ page, addressOf }) => {
    const address = await addressOf('e2e-waiting');
    test.skip(address.includes('/sites/'), 'In path mode /sites/<slug> is the Address itself');

    await page.goto(`${BASE_URL}/sites/e2e-waiting`);
    await expect(page).toHaveURL(new URL(address).href);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for Wanda');
  });

  test('answers 404 for a Slug no Site has', async ({ page, addressOf }) => {
    const address = await addressOf('e2e-waiting');
    const response = await page.goto(address.replace('e2e-waiting', 'e2e-no-such-site'));
    expect(response?.status()).toBe(404);
  });
});
