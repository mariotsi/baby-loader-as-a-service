import { FIXTURE_PLACE } from './support/data.ts';
import { BASE_URL } from './support/env.ts';
import { expect, test } from './support/test.ts';

test.describe('Public page', () => {
  test('in the Waiting state leads with the Countdown', async ({ page, addressOf }) => {
    await page.goto(await addressOf('e2e-waiting'));

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for Wanda');
    await expect(page.getByText('It’s a girl')).toBeVisible();
    await expect(page.getByText(/^Due date:/)).toBeVisible();
    await expect(page.getByText(/^\d+ days to go$/)).toBeVisible();
    await expect(page.getByRole('banner')).toHaveText('Wilma & Walter');
  });

  test('in the Born state leads with the Birth details', async ({ page, addressOf }) => {
    await page.goto(await addressOf('e2e-born'));

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome Bruno');
    await expect(page.getByText(/^Born on /)).toBeVisible();
    await expect(page.getByText('Weight: 3250 g')).toBeVisible();
    await expect(page.getByText('Length: 50 cm')).toBeVisible();
    await expect(page.getByText(/ days to go$/)).toHaveCount(0);
    await expect(page.getByRole('banner')).toHaveText('Bea & Bob');
  });

  test('links a Milestone’s Place to its address on Google Maps', async ({ page, addressOf }) => {
    // The map's style never loads in tests, so the page falls back to the address alone.
    await page.route('https://tiles.openfreemap.org/**', (route) => route.abort());
    await page.goto(await addressOf('e2e-waiting'));

    const link = page.getByRole('link', { name: `Open ${FIXTURE_PLACE.address} in Google Maps` });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toHaveText(FIXTURE_PLACE.address);
    await expect(link).toHaveAttribute(
      'href',
      `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: FIXTURE_PLACE.address })}`
    );
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // The attribution goes with the map it credits.
    await expect(page.getByRole('link', { name: 'OpenStreetMap' })).toBeHidden();
  });

  test('hides the name and Sex when Privacy settings say so', async ({ page, addressOf }) => {
    await page.goto(await addressOf('e2e-private'));

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for someone');
    await expect(page.getByText('Priscilla')).toHaveCount(0);
    await expect(page.getByText('It’s a girl')).toHaveCount(0);
  });

  test('with two Languages follows the Visitor’s language and the Language switcher', async ({ page, addressOf }) => {
    await page.goto(await addressOf('e2e-both'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for Bianca');

    // Switching swaps the view in place: a marker set before the click survives it.
    await page.evaluate(() => {
      (window as { stillHere?: boolean }).stillHere = true;
    });
    await page.getByRole('radio', { name: 'Italiano' }).check();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stiamo aspettando Bianca');
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    expect(await page.evaluate(() => (window as { stillHere?: boolean }).stillHere)).toBe(true);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stiamo aspettando Bianca');
  });

  test.describe('for an Italian browser', () => {
    test.use({ locale: 'it-IT' });

    test('with two Languages opens in Italian', async ({ page, addressOf }) => {
      await page.goto(await addressOf('e2e-both'));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stiamo aspettando Bianca');
    });
  });

  test.describe('for a French browser', () => {
    test.use({ locale: 'fr-FR' });

    test('opens in English when the Site speaks it and not French', async ({ page, addressOf }) => {
      // e2e-both speaks Italian and English: neither is French, so English, the first fallback, wins.
      await page.goto(await addressOf('e2e-both'));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('We are waiting for Bianca');
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
