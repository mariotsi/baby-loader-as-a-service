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

  test('onboarding shows the Address while the Owner types the Slug', async ({ page, addressOf }) => {
    const known = await addressOf('e2e-waiting');
    await page.goto('/onboarding');
    const slugField = page.getByLabel('Site address');

    await slugField.fill('e2e-new-baby');
    // The fixture reads a link's resolved href, which ends in "/" at a host's root; the page writes the Address without it.
    const expected = known.replace('e2e-waiting', 'e2e-new-baby').replace(/\/$/, '');
    await expect(page.getByText(/^Your page will be at /)).toHaveText(`Your page will be at ${expected}`);
    await slugField.fill('-bad');
    await expect(page.getByText(/^Use 3-32 lowercase letters/)).toBeVisible();
    await slugField.fill('staging');
    await expect(page.getByText('This address is reserved.')).toBeVisible();
  });

  test('links a Site’s Address on its page', async ({ page, addressOf }) => {
    const address = await addressOf('e2e-waiting');
    await page.goto('/admin/e2e-waiting');
    const link = page.getByRole('link', { name: address.replace(/^https?:\/\//, '').replace(/\/$/, '') });
    expect(await link.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(address);
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
    await page.getByRole('checkbox', { name: 'Italian' }).check();
    await page.getByRole('button', { name: 'Add milestone' }).click();
    const milestone = page.getByRole('group', { name: 'Milestone 1' });
    await milestone.getByLabel('Date').fill('2026-01-18');
    await milestone.getByLabel('English').fill('Coming home');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(milestone.getByText('Write this Milestone in Italian.')).toBeVisible();
    await expect(milestone.getByLabel('Italian')).toBeFocused();
    await milestone.getByLabel('Italian').fill('Si torna a casa');
    await expect(milestone.getByText('Write this Milestone in Italian.')).toBeHidden();
    await page.getByRole('checkbox', { name: 'English' }).uncheck();
    await page.getByLabel('Page name').fill('Elena e Ettore');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Edith Rose');
    await expect(page.getByLabel('The baby has been born')).toBeChecked();
    await expect(page.getByLabel('Weight (g)')).toHaveValue('3100');
    await expect(page.getByRole('group', { name: 'Milestone 1' }).getByLabel('Label')).toHaveValue('Si torna a casa');
    await expect(page.getByRole('checkbox', { name: 'Italian' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'English' })).not.toBeChecked();
    await expect(page.getByLabel('Page name')).toHaveValue('Elena e Ettore');

    await page.goto(await dashboardAddress(page, slug));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Benvenuto/a Edith Rose');
    await expect(page.getByText('Peso: 3100 g')).toBeVisible();
    await expect(page.getByText('È una femmina')).toBeVisible();
    await expect(page.getByRole('banner')).toHaveText('Elena e Ettore');
    await expect(page.getByText('Si torna a casa')).toBeVisible();
  });

  test('explains a missing birth date and time and a weight in fractions of a gram', async ({ page, project }) => {
    await page.goto(`/admin/${perProjectSlug('e2e-rules', project)}`);

    await page.getByLabel('The baby has been born').check();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Birth date & time is required.', { exact: true })).toBeVisible();

    await page.getByLabel('Birth date & time').fill('2026-01-15T08:30');
    await page.getByLabel('Weight (g)').fill('3400.5');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Weight must be a whole number of grams.', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('The baby has been born')).not.toBeChecked();
  });

  test('keeps a Birth message in a Language the Site no longer speaks', async ({ page, project }) => {
    await page.goto(`/admin/${perProjectSlug('e2e-messages', project)}`);

    await page.getByLabel('The baby has been born').check();
    await page.getByLabel('Birth date & time').fill('2026-01-15T08:30');
    const message = page.getByRole('group', { name: /^Message/ });
    await message.getByLabel('Italian').fill('Benvenuta Marta!');
    await message.getByLabel('English').fill('Welcome Marta!');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    // 'Saved.' is still on screen from the first save, so wait for the second one itself.
    await page.getByRole('checkbox', { name: 'Italian' }).uncheck();
    const saved = page.waitForResponse((res) => res.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await saved).ok()).toBe(true);

    // A reload drops the form's own state: what follows comes from the saved Site.
    await page.reload();
    await expect(page.getByLabel('Message optional', { exact: true })).toHaveValue('Welcome Marta!');
    await page.getByRole('checkbox', { name: 'Italian' }).check();
    await expect(message.getByLabel('Italian')).toHaveValue('Benvenuta Marta!');
  });

  test('saves a Milestone’s Place only once it is picked from the search', async ({ page, project }) => {
    // Photon never sees a test: it is unreachable first, then answers from here.
    await page.route(PHOTON, (route) => route.abort());
    await page.goto(`/admin/${perProjectSlug('e2e-places', project)}`);
    const milestone = page.getByRole('group', { name: 'Milestone 1' });
    const place = milestone.getByRole('combobox', { name: /^Place/ });

    await place.fill('niguarda');
    await expect(milestone.getByRole('status')).toHaveText(
      'Search is unavailable right now. Clear the field to save without a place.'
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(milestone.getByText('Pick a place from the list, or clear the field.')).toBeVisible();
    await expect(place).toBeFocused();

    await page.unroute(PHOTON);
    await page.route(PHOTON, (route) => route.fulfill({ json: PHOTON_RESULTS }));
    await place.fill('ospedale niguarda');
    await expect(milestone.getByRole('option')).toHaveCount(2);
    await milestone.getByRole('option', { name: NIGUARDA }).click();
    await expect(place).toHaveValue(NIGUARDA);
    await expect(milestone.getByText('Pick a place from the list, or clear the field.')).toBeHidden();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.reload();
    await expect(place).toHaveValue(NIGUARDA);
    await milestone.getByRole('button', { name: 'Remove the place' }).click();
    await expect(place).toHaveValue('');
  });
});

const PHOTON = 'https://photon.komoot.io/**';
const NIGUARDA = 'Ospedale Niguarda, Via Renato Donatelli, 20162 Milano, Italia';

/** Photon's answer, whatever the search: a hospital and a house, as GeoJSON Features. */
const PHOTON_RESULTS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [9.1899, 45.5093] },
      properties: {
        type: 'house',
        name: 'Ospedale Niguarda',
        street: 'Via Renato Donatelli',
        postcode: '20162',
        city: 'Milano',
        country: 'Italia',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [9.1866, 45.4654] },
      properties: {
        type: 'house',
        housenumber: '12',
        street: 'Via Roma',
        postcode: '20121',
        city: 'Milano',
        country: 'Italia',
      },
    },
  ],
};
