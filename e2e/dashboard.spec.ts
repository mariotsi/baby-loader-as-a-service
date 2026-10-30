import { perProjectSlug } from './support/data.ts';
import { ownerStatePath } from './support/env.ts';
import { dashboardAddress, expect, test } from './support/test.ts';

test.use({ storageState: ownerStatePath('a') });

test.describe('Dashboard', () => {
  test('lists the Owner’s Sites with their Addresses', async ({ page }) => {
    await page.goto('/dashboard');
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
    await page.goto('/dashboard/e2e-waiting');
    const link = page.getByRole('link', { name: address.replace(/^https?:\/\//, '').replace(/\/$/, '') });
    expect(await link.evaluate((a) => (a as HTMLAnchorElement).href)).toBe(address);
  });

  test('saves Site settings and marks the baby as born', async ({ page, project }) => {
    const slug = perProjectSlug('e2e-edit', project);
    await page.goto(`/dashboard/${slug}`);

    await page.getByLabel('Name', { exact: true }).fill('Edith Rose');
    await page.getByLabel('Sex', { exact: true }).selectOption('female');
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

    // Announcing the birth saves every other change on the page with it.
    await page.getByRole('button', { name: 'Announce the birth' }).click();
    const dialog = page.getByRole('dialog', { name: 'Welcome, Edith Rose' });
    await expect(dialog.getByLabel('Birth date & time')).toBeFocused();
    await dialog.getByLabel('Birth date & time').fill('2026-01-15T08:30');
    await dialog.getByLabel('Weight (g)').fill('3100');
    await dialog.getByLabel('Length (cm)').fill('49');
    // Beside the fields, the notification and the page once born, both in the Site's Language.
    await expect(dialog.getByText('È nata Edith Rose!')).toBeVisible();
    const pagePreview = dialog.getByRole('region', { name: 'Your page on a phone' });
    await expect(pagePreview.getByText('3100 g')).toBeVisible();
    // The preview shows the notifications button, inert: nobody can press anything in it.
    await expect(pagePreview.locator('[inert]').getByText('Ricevi i prossimi aggiornamenti')).toBeVisible();
    await dialog.getByRole('button', { name: 'Announce the birth' }).click();
    // Announcing asks first, so a slip of the finger cannot send the notification.
    const confirm = page.getByRole('dialog', { name: 'Announce the birth now?' });
    await expect(confirm.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Announce the birth' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/^Announced\. Notification sent to \d+ of \d+ subscribers?\.$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit the birth details' })).toBeFocused();

    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Edith Rose');
    await expect(page.getByText('Born January 15, 2026')).toBeVisible();
    await expect(page.getByText('3100 g · 49 cm')).toBeVisible();
    await page.getByRole('button', { name: 'Edit the birth details' }).click();
    await expect(page.getByRole('dialog', { name: 'Birth details' }).getByLabel('Weight (g)')).toHaveValue('3100');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('group', { name: 'Milestone 1' }).getByLabel('Label')).toHaveValue('Si torna a casa');
    // Announcing added the Birth milestone, in the Site's Language.
    await expect(page.getByRole('group', { name: 'Milestone 2' }).getByLabel('Label')).toHaveValue('È nata!');
    await expect(page.getByRole('checkbox', { name: 'Italian' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'English' })).not.toBeChecked();
    await expect(page.getByLabel('Page name')).toHaveValue('Elena e Ettore');

    await page.goto(await dashboardAddress(page, slug));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Benvenuta Edith Rose');
    await expect(page.getByRole('listitem').filter({ hasText: 'Peso' }).getByText('3100 g')).toBeVisible();
    await expect(page.getByText('È nata!', { exact: true })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: '👶' })).toContainText('È nata!');
    await expect(page.getByRole('banner')).toHaveText('Elena e Ettore');
    await expect(page.getByText('Si torna a casa')).toBeVisible();
  });

  test('explains a missing birth date and time and a weight in fractions of a gram', async ({ page, project }) => {
    await page.goto(`/dashboard/${perProjectSlug('e2e-rules', project)}`);

    await page.getByRole('button', { name: 'Announce the birth' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Birth date & time').fill('');
    await dialog.getByRole('button', { name: 'Announce the birth' }).click();
    await expect(dialog.getByText('Birth date & time is required.', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Birth date & time')).toBeFocused();

    await dialog.getByLabel('Birth date & time').fill('2026-01-15T08:30');
    await dialog.getByLabel('Weight (g)').fill('3400.5');
    await dialog.getByRole('button', { name: 'Announce the birth' }).click();
    await expect(dialog.getByText('Weight must be a whole number of grams.', { exact: true })).toBeVisible();

    // Closing the dialog drops what it holds: the page is still waiting.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Announce the birth' })).toBeVisible();
  });

  test('keeps a Birth message in a Language the Site no longer speaks', async ({ page, project }) => {
    await page.goto(`/dashboard/${perProjectSlug('e2e-messages', project)}`);

    await page.getByRole('button', { name: 'Announce the birth' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Birth date & time').fill('2026-01-15T08:30');
    const message = dialog.getByRole('group', { name: /^Message/ });
    await message.getByLabel('Italian').fill('Benvenuta Marta!');
    await message.getByLabel('English').fill('Welcome Marta!');
    await dialog.getByRole('button', { name: 'Announce the birth' }).click();
    await page
      .getByRole('dialog', { name: 'Announce the birth now?' })
      .getByRole('button', { name: 'Announce the birth' })
      .click();
    await expect(page.getByText(/^Announced\./)).toBeVisible();

    // The first save's message is still on screen, so wait for the second save itself.
    await page.getByRole('checkbox', { name: 'Italian' }).uncheck();
    const saved = page.waitForResponse((res) => res.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await saved).ok()).toBe(true);

    // A reload drops the form's own state: what follows comes from the saved Site.
    await page.reload();
    await page.getByRole('button', { name: 'Edit the birth details' }).click();
    await expect(dialog.getByLabel('Message Optional', { exact: true })).toHaveValue('Welcome Marta!');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('checkbox', { name: 'Italian' }).check();
    await page.getByRole('button', { name: 'Edit the birth details' }).click();
    await expect(message.getByLabel('Italian')).toHaveValue('Benvenuta Marta!');
  });

  test('saves a Milestone’s Place only once it is picked from the search', async ({ page, project }) => {
    // Photon never sees a test: it is unreachable first, then answers from here.
    await page.route(PHOTON, (route) => route.abort());
    await page.goto(`/dashboard/${perProjectSlug('e2e-places', project)}`);
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
