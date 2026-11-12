import type { BirthWrite } from './birthChange.ts';
import type { DeliveryResult } from './notificationDelivery.ts';
import type { OwnedSite } from './ownerAccess.ts';
import { type SiteSettings, type SiteSettingsError, siteSettingsOf } from './siteSettings.ts';

/**
 * The Activity log: one structured line for each thing a person does that
 * changes the Platform, written to the Worker's console, where Workers Logs
 * stores it and indexes every field. Query it by `event`, `slug`, `userId`
 * or `ok` (see "Activity log" in README.md).
 *
 * A line says who did what to which Site and how it went. A write to a Site's
 * settings carries the values it changed, the baby's name and the Birth among
 * them, so the log holds what the database holds, for as long as Workers Logs
 * keeps it. It never carries an email, a password, a push endpoint, or the
 * text of a Notification.
 */

export type ActivityEvent =
  | 'user.signup'
  | 'user.login'
  | 'user.passwordChange'
  | 'site.create'
  | 'site.saveSettings'
  | 'site.setBirth'
  | 'site.clearBirth'
  | 'notification.send'
  | 'notification.finish'
  | 'subscription.add'
  | 'subscription.remove'
  | 'media.upload'
  | 'media.remove';

export interface ActivityFields {
  /** Whether the action went through. */
  ok: boolean;
  /** Why it did not: a route error code, `invalid` for Site settings errors, or `stale`. */
  reason?: string;
  slug?: string;
  userId?: string;
  [field: string]: unknown;
}

export type ActivityWriter = Pick<Console, 'log' | 'warn'>;

/** Writes one Activity log line: a warning when the action was refused, so the level alone finds what went wrong. */
export function logActivity(event: ActivityEvent, fields: ActivityFields, writer: ActivityWriter = console): void {
  const line = { event, ...fields };
  if (fields.ok) {
    writer.log(line);
  } else {
    writer.warn(line);
  }
}

/** Site settings errors as `path:code`, which says what was wrong without the value that was. */
export function errorList(errors: readonly SiteSettingsError[]): string[] {
  return errors.map(({ path, code }) => `${path}:${code}`);
}

/** How a Notification's delivery went, for a line about sending one. */
export function deliveryActivity(owned: OwnedSite, delivery: DeliveryResult): ActivityFields {
  return { ...siteAndOwner(owned), ok: true, delivery };
}

/** A setting's value before and after a write. */
export type SettingChange = { from: unknown; to: unknown };

/** The Milestones a write added and removed; an edited one is in both, as it was and as it is. */
export type MilestonesChange = { added: unknown[]; removed: unknown[] };

/**
 * How a write to a Site's settings went: the settings it changed, by name in
 * `changed` and with their values in `changes`, whether it announced the
 * Birth, and how the Birth notification went.
 */
export function siteWriteActivity(owned: OwnedSite, result: BirthWrite): ActivityFields {
  const who = siteAndOwner(owned);
  if (!result.ok) {
    return 'errors' in result
      ? { ...who, ok: false, reason: 'invalid', errors: errorList(result.errors) }
      : { ...who, ok: false, reason: result.refused };
  }
  const changes = settingChanges(siteSettingsOf(owned.site), siteSettingsOf(result.site));
  const { notification } = result;
  return {
    ...who,
    ok: true,
    changed: Object.keys(changes),
    changes,
    announced: !owned.site.birth.born && result.site.birth.born,
    ...birthNotificationActivity(notification),
  };
}

function birthNotificationActivity(notification: DeliveryResult | 'failed' | null) {
  if (notification === null) {
    return { notification: 'none', delivery: undefined };
  }
  if (notification === 'failed') {
    return { notification: 'failed', delivery: undefined };
  }
  return { notification: 'sent', delivery: notification };
}

function settingChanges(before: SiteSettings, after: SiteSettings): Record<string, SettingChange | MilestonesChange> {
  const changes: Record<string, SettingChange | MilestonesChange> = {};
  for (const key of Object.keys(after) as (keyof SiteSettings)[]) {
    if (same(before[key], after[key])) {
      continue;
    }
    changes[key] =
      key === 'milestones'
        ? {
            added: missingFrom(before.milestones, after.milestones),
            removed: missingFrom(after.milestones, before.milestones),
          }
        : { from: before[key], to: after[key] };
  }
  return changes;
}

/** The items of `list` that `others` has no equal of. */
function missingFrom(others: readonly unknown[], list: readonly unknown[]): unknown[] {
  return list.filter((item) => !others.some((other) => same(item, other)));
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function siteAndOwner(owned: OwnedSite): { slug: string; userId: string } {
  return { slug: owned.site.slug, userId: owned.owner.id };
}
