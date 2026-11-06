import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { Slug } from '../lib/address.ts';
import type { DeviceInfo } from '../lib/deviceInfo.ts';
import type { Email } from '../lib/email.ts';
import type { GeoLocation } from '../lib/geoip.ts';
import type { Lang } from '../lib/i18n.ts';
import type { DeliveryStatus, NotificationKind, NotificationMessages } from '../lib/notificationLog.ts';
import type { SiteSettings } from '../lib/siteSettings.ts';

/**
 * The D1 schema (ADR-0009). Ids are random UUIDs (newId) and
 * dates are ISO 8601 UTC text, which sorts in time order. `npm run
 * db:generate` turns a change here into a migration in migrations/.
 */

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').$type<Email>().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
});

export const sites = sqliteTable(
  'sites',
  {
    id: text('id').primaryKey(),
    slug: text('slug').$type<Slug>().notNull().unique(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    /** Every Site setting, saved and replaced as one value (saveSiteSettings). */
    settings: text('settings', { mode: 'json' }).$type<SiteSettings>().notNull(),
    customDomain: text('custom_domain'),
    customDomainVerified: integer('custom_domain_verified', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('sites_owner_created').on(table.ownerId, table.createdAt),
    // Most Sites have no Custom domain, so uniqueness applies only to set values.
    uniqueIndex('sites_custom_domain').on(table.customDomain).where(sql`${table.customDomain} IS NOT NULL`),
  ]
);

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    lang: text('lang').$type<Lang>(),
    deviceInfo: text('device_info', { mode: 'json' }).$type<DeviceInfo>(),
    geo: text('geo', { mode: 'json' }).$type<GeoLocation>(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('subscriptions_site_endpoint').on(table.siteId, table.endpoint),
    index('subscriptions_site_created').on(table.siteId, table.createdAt),
    index('subscriptions_endpoint').on(table.endpoint),
  ]
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id),
    kind: text('kind').$type<NotificationKind>().notNull(),
    messages: text('messages', { mode: 'json' }).$type<NotificationMessages>().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('notifications_site_created').on(table.siteId, table.createdAt)]
);

/** Keyed by a plain row number: a Delivery's id never leaves the database. */
export const notificationDeliveries = sqliteTable(
  'notification_deliveries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    notificationId: text('notification_id')
      .notNull()
      .references(() => notifications.id),
    /** Null once the Subscription is gone; the Delivery stays with its Notification. */
    subscriptionId: text('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    deviceLabel: text('device_label'),
    status: text('status').$type<DeliveryStatus>().notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('notification_deliveries_notification_status').on(table.notificationId, table.status),
    index('notification_deliveries_subscription').on(table.subscriptionId),
  ]
);
