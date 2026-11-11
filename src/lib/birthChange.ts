/**
 * Every write to a Site's settings: the Birth dialog's, going back to the
 * Countdown, and the rest of the Site settings. The Birth changes only here,
 * so announcing it is one request that saves, settles the Birth milestone and
 * sends the Birth notification (ADR-0010).
 */
import { type BirthFields, birthNotificationMessages, settledBirthMilestones, withBirth } from './birthAnnouncement.ts';
import {
  type DeliveryResult,
  deliverNotification,
  type PushService,
  parseNotification,
} from './notificationDelivery.ts';
import type { OwnedSite } from './ownerAccess.ts';
import { type Site, saveSiteSettings } from './site.ts';
import type { SiteMedia } from './siteMedia.ts';
import {
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsError,
  settingsPath,
  siteSettingsOf,
} from './siteSettings.ts';

export interface BirthWriteDeps {
  /** Null when push is not configured: announcing still saves, and says the notification failed. */
  push: PushService | null;
  /** Called only when a write carries media or replaces some. */
  media: () => Pick<SiteMedia, 'owns' | 'removeReplaced'>;
  now?: Date;
}

/**
 * How a write went. `notification` is the Birth notification announcing sent,
 * `'failed'` when it could not go out, and null when the write announced nothing.
 * `stale` means the Site changed since the tab read it.
 */
export type BirthWrite =
  | { ok: true; site: Site; notification: DeliveryResult | 'failed' | null }
  | { ok: false; errors: SiteSettingsError[] }
  | { ok: false; refused: 'stale' | 'invalidRequest' };

const BIRTH_FIELDS = ['updatedAt', 'babyName', 'sex', 'details', 'birthVideo'];

/** Sets the Birth: `{ updatedAt, babyName, sex, details, birthVideo }`. Announces it when the Site was Waiting. */
export async function setBirth(owned: OwnedSite, body: unknown, deps: BirthWriteDeps): Promise<BirthWrite> {
  if (!isRecord(body) || Object.keys(body).some((key) => !BIRTH_FIELDS.includes(key))) {
    return { ok: false, refused: 'invalidRequest' };
  }
  const fields = body as unknown as BirthFields;
  return await write(owned, body.updatedAt, withBirth(siteSettingsOf(owned.site), fields), deps);
}

/** Goes back to the Countdown: `{ updatedAt }`. The Birth video stays, ready for the day. */
export async function clearBirth(owned: OwnedSite, body: unknown, deps: BirthWriteDeps): Promise<BirthWrite> {
  if (!isRecord(body)) {
    return { ok: false, refused: 'invalidRequest' };
  }
  return await write(owned, body.updatedAt, withBirth(siteSettingsOf(owned.site), null), deps);
}

/** Saves every Site setting but the Birth, which only the Birth endpoint changes: `{ updatedAt, settings }`. */
export async function saveSettings(owned: OwnedSite, body: unknown, deps: BirthWriteDeps): Promise<BirthWrite> {
  if (!isRecord(body) || !isRecord(body.settings)) {
    return { ok: false, refused: 'invalidRequest' };
  }
  if ('birth' in body.settings) {
    return { ok: false, errors: [{ path: settingsPath('birth'), code: 'unknownField' }] };
  }
  const { birth } = owned.site;
  const settings = body.settings as Partial<SiteSettings>;
  const next = {
    ...settings,
    birth,
    milestones: Array.isArray(settings.milestones)
      ? settledBirthMilestones(settings.milestones, birth, String(settings.timezone))
      : settings.milestones,
  };
  return await write(owned, body.updatedAt, next, deps);
}

async function write(owned: OwnedSite, updatedAt: unknown, next: unknown, deps: BirthWriteDeps): Promise<BirthWrite> {
  if (typeof updatedAt !== 'string') {
    return { ok: false, refused: 'invalidRequest' };
  }
  if (updatedAt !== owned.site.updatedAt) {
    return { ok: false, refused: 'stale' };
  }
  const parsed = parseSiteSettings(next, deps.now);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }
  if (!ownMedia(parsed.value, owned, deps)) {
    return { ok: false, refused: 'invalidRequest' };
  }
  const saved = await saveSiteSettings(owned, parsed.value, updatedAt);
  if (!saved) {
    return { ok: false, refused: 'stale' };
  }
  await removeReplacedMedia(owned, saved, deps);
  const announcing = !owned.site.birth.born && saved.birth.born;
  return { ok: true, site: saved, notification: announcing ? await announce({ ...owned, site: saved }, deps) : null };
}

/** Sends the Birth notification for a Site just announced. */
async function announce(owned: OwnedSite, { push }: BirthWriteDeps): Promise<DeliveryResult | 'failed'> {
  const { site } = owned;
  if (!push || !site.birth.born) {
    return 'failed';
  }
  const notification = parseNotification(birthNotificationMessages(site, site.birth.details.message), site.languages);
  if (!notification.ok) {
    return 'failed';
  }
  try {
    return await deliverNotification(owned, notification.value, push, { kind: 'birth' });
  } catch {
    return 'failed';
  }
}

/** Whether every file the settings point at is one the Owner uploaded to this Site. */
function ownMedia({ birth, birthVideo }: SiteSettings, owned: OwnedSite, { media }: BirthWriteDeps): boolean {
  const files = [birth.details?.photo, birthVideo].filter((file) => !!file);
  if (files.length === 0) {
    return true;
  }
  try {
    const siteMedia = media();
    return files.every((file) => siteMedia.owns(owned.site, file));
  } catch {
    return false;
  }
}

/** Deletes the photo and Birth video the save replaced. A failure leaves the file behind, and the save stands. */
async function removeReplacedMedia(owned: OwnedSite, saved: Site, { media }: BirthWriteDeps): Promise<void> {
  const replaced = (site: Site) => [site.birth.details?.photo?.key, site.birthVideo?.key];
  const [before, after] = [replaced(owned.site), replaced(saved)];
  if (before.every((key) => !key || after.includes(key))) {
    return;
  }
  try {
    await media().removeReplaced(owned.site, saved);
  } catch {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
