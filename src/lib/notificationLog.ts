import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { type DeliveryId, type NotificationId, newNotificationId, type SiteId } from '../db/ids.ts';
import { getDb } from '../db/index.ts';
import { notificationDeliveries, notifications, subscriptions } from '../db/schema.ts';
import type { Lang } from './i18n.ts';
import type { PushSubscriptionRecord } from './subscription.ts';

/**
 * Every Notification a Site sent, with what became of it on each device
 * (ADR-0010). A Delivery is created `pending` for each Subscription the Site
 * has when the Notification is sent, so later Subscriptions never join it.
 */

export type NotificationKind = 'general' | 'birth';

export type NotificationText = { title?: string; body: string };

export type NotificationMessages = Partial<Record<Lang, NotificationText>>;

export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'gone';

export interface LoggedDelivery {
  deviceLabel: string | null;
  status: DeliveryStatus;
}

export interface LoggedNotification {
  id: NotificationId;
  kind: NotificationKind;
  messages: NotificationMessages;
  /** ISO 8601 UTC. */
  createdAt: string;
  deliveries: LoggedDelivery[];
}

/** A Delivery still to send, with the Subscription it goes to; null once that Subscription is gone. */
export interface OutstandingDelivery {
  id: DeliveryId;
  subscription: PushSubscriptionRecord | null;
}

/** Stores the Notification and its Deliveries in one batch and returns its id. */
export async function logNotification(
  siteId: SiteId,
  kind: NotificationKind,
  messages: NotificationMessages
): Promise<NotificationId> {
  const id = newNotificationId();
  const now = new Date().toISOString();
  const db = getDb();
  await db.batch([
    db.insert(notifications).values({ id, siteId, kind, messages, createdAt: now }),
    db.insert(notificationDeliveries).select(
      db
        .select({
          // SQLite numbers a row given a null INTEGER PRIMARY KEY.
          id: sql<number>`NULL`.as('id'),
          notificationId: sql<string>`${id}`.as('notification_id'),
          subscriptionId: subscriptions.id,
          deviceLabel: sql<string | null>`json_extract(${subscriptions.deviceInfo}, '$.label')`.as('device_label'),
          status: sql<DeliveryStatus>`'pending'`.as('status'),
          updatedAt: sql<string>`${now}`.as('updated_at'),
        })
        .from(subscriptions)
        .where(eq(subscriptions.siteId, siteId))
    ),
  ]);
  return id;
}

export async function findNotification(siteId: SiteId, id: NotificationId): Promise<LoggedNotification | null> {
  const row = await getDb().query.notifications.findFirst({
    where: and(eq(notifications.id, id), eq(notifications.siteId, siteId)),
  });
  if (!row) {
    return null;
  }
  const { siteId: _, ...notification } = row;
  return { ...notification, deliveries: await deliveriesOf(id) };
}

/** The Site's Notifications, newest first. */
export async function listNotifications(siteId: SiteId): Promise<LoggedNotification[]> {
  const rows = await getDb().query.notifications.findMany({
    where: eq(notifications.siteId, siteId),
    orderBy: desc(notifications.createdAt),
  });
  return Promise.all(
    rows.map(async ({ siteId: _, ...notification }) => ({
      ...notification,
      deliveries: await deliveriesOf(notification.id),
    }))
  );
}

function deliveriesOf(notificationId: NotificationId): Promise<LoggedDelivery[]> {
  return getDb()
    .select({ deviceLabel: notificationDeliveries.deviceLabel, status: notificationDeliveries.status })
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.notificationId, notificationId))
    .orderBy(notificationDeliveries.id);
}

/** The Deliveries sending has not finished: those never tried, and those that failed. */
export async function outstandingDeliveries(notificationId: NotificationId): Promise<OutstandingDelivery[]> {
  const rows = await getDb()
    .select({ id: notificationDeliveries.id, subscription: subscriptions })
    .from(notificationDeliveries)
    .leftJoin(subscriptions, eq(notificationDeliveries.subscriptionId, subscriptions.id))
    .where(
      and(
        eq(notificationDeliveries.notificationId, notificationId),
        inArray(notificationDeliveries.status, ['pending', 'failed'])
      )
    )
    .orderBy(notificationDeliveries.id);
  return rows.map(({ id, subscription }) => {
    if (!subscription) {
      return { id, subscription: null };
    }
    const { p256dh, auth, ...rest } = subscription;
    return { id, subscription: { ...rest, keys: { p256dh, auth } } };
  });
}

/** Records one batch of outcomes at once; `ids` per status stay under D1's bound parameter limit. */
export async function recordDeliveries(outcomes: Map<DeliveryStatus, DeliveryId[]>): Promise<void> {
  const now = new Date().toISOString();
  const db = getDb();
  await Promise.all(
    [...outcomes].map(([status, ids]) =>
      db.update(notificationDeliveries).set({ status, updatedAt: now }).where(inArray(notificationDeliveries.id, ids))
    )
  );
}
