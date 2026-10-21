import { perProjectSlug } from './support/data.ts';
import { expect, fakePushService, test } from './support/test.ts';

test('a Visitor subscribes and the Owner sends them a Notification', async ({ page, project, addressOf, ownerPage }) => {
  const slug = perProjectSlug('e2e-notify', project);

  await fakePushService(page);
  await page.goto(await addressOf(slug));
  await page.getByRole('button', { name: 'Notify me when they arrive' }).click();
  await expect(page.getByText('You are all set.')).toBeVisible();
  await expect(page.getByText('Birth notification is on for this device')).toBeVisible();

  const owner = await ownerPage('a');
  await owner.goto(`/admin/${slug}/subscriptions`);
  await expect(owner.getByText('1 device(s) subscribed.')).toBeVisible();

  await owner.goto(`/admin/${slug}/send`);
  await owner.getByLabel('Message').fill('Any day now!');
  await owner.getByRole('button', { name: 'Send notification' }).click();
  // The fake push service never answers, so delivery fails; the attempt reaching
  // the one Subscriber is what this checks.
  await expect(owner.getByText(/^Sent to 0 of 1 subscribers\.$/)).toBeVisible();

  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByText('Notifications turned off.')).toBeVisible();
  await owner.goto(`/admin/${slug}/subscriptions`);
  await expect(owner.getByText('0 device(s) subscribed.')).toBeVisible();
});
