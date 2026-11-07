import * as z from 'zod/mini';

/**
 * Row ids, one brand per table, so a Site's id can't be passed where a User's
 * is expected. Ids are random UUIDs, which can't be guessed from another one
 * (they travel in session cookies and URLs); an id that comes from outside is
 * checked against that shape with its guard, and anything else matches no row.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const uuid = () => z.string().check(z.regex(UUID_V4));

export const userIdSchema = uuid().brand<'UserId'>();
export type UserId = z.output<typeof userIdSchema>;
export function isUserId(value: unknown): value is UserId {
  return userIdSchema.safeParse(value).success;
}
export function newUserId(): UserId {
  return userIdSchema.parse(crypto.randomUUID());
}

export const siteIdSchema = uuid().brand<'SiteId'>();
export type SiteId = z.output<typeof siteIdSchema>;
export function isSiteId(value: unknown): value is SiteId {
  return siteIdSchema.safeParse(value).success;
}
export function newSiteId(): SiteId {
  return siteIdSchema.parse(crypto.randomUUID());
}

export const subscriptionIdSchema = uuid().brand<'SubscriptionId'>();
export type SubscriptionId = z.output<typeof subscriptionIdSchema>;
export function isSubscriptionId(value: unknown): value is SubscriptionId {
  return subscriptionIdSchema.safeParse(value).success;
}
export function newSubscriptionId(): SubscriptionId {
  return subscriptionIdSchema.parse(crypto.randomUUID());
}

export const notificationIdSchema = uuid().brand<'NotificationId'>();
export type NotificationId = z.output<typeof notificationIdSchema>;
export function isNotificationId(value: unknown): value is NotificationId {
  return notificationIdSchema.safeParse(value).success;
}
export function newNotificationId(): NotificationId {
  return notificationIdSchema.parse(crypto.randomUUID());
}

/** A Delivery's row number: D1 assigns it, and it never leaves the database. */
export const deliveryIdSchema = z.int().brand<'DeliveryId'>();
export type DeliveryId = z.output<typeof deliveryIdSchema>;
