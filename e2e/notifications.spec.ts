import { perProjectSlug } from './support/data.ts';
import { expect, fakePushService, test } from './support/test.ts';

test('a Visitor subscribes and the Owner sends them a Notification', async ({
  page,
  project,
  addressOf,
  ownerPage,
}) => {
  const slug = perProjectSlug('e2e-notify', project);

  await fakePushService(page);
  await page.goto(await addressOf(slug));
  await page.getByRole('button', { name: 'Notify me when she arrives' }).click();
  await expect(page.getByText('Notifications active on this device')).toBeVisible();

  const owner = await ownerPage('a');
  await owner.goto(`/dashboard/${slug}/subscriptions`);
  await expect(owner.getByText('1 device subscribed.')).toBeVisible();

  await owner.goto(`/dashboard/${slug}/send`);
  await owner.getByLabel('Message').fill('Any day now!');
  await owner.getByRole('button', { name: 'Send notification' }).click();
  // The fake push service never answers, so delivery fails; the attempt reaching
  // the one Subscription is what this checks.
  await expect(owner.getByText(/^Sent to 0 of 1 subscriber\.$/)).toBeVisible();

  await page.getByRole('button', { name: 'Turn them off' }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation.getByRole('button', { name: 'Keep notifications on' })).toBeFocused();
  await confirmation.getByRole('button', { name: 'Turn off notifications', exact: true }).click();
  await expect(page.getByText('Notifications turned off.')).toBeVisible();
  await owner.goto(`/dashboard/${slug}/subscriptions`);
  await expect(owner.getByText('0 devices subscribed.')).toBeVisible();
});

test('an iPhone browser explains Home Screen installation before subscribing', async ({ page, project, addressOf }) => {
  test.skip(project !== 'iphone', 'Home Screen installation is required on iPhone');
  await page.goto(await addressOf('e2e-waiting'));
  await expect(
    page.getByText('On iPhone, web notifications work only after you add this page to your Home Screen as a web app.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Notify me/ })).toHaveCount(0);
});
