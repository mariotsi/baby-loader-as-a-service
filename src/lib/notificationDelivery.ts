import * as z from 'zod/mini';
import { siteAddressPath } from './address.ts';
import { birthMediaUrl } from './birthMedia.ts';
import { addressEnv, deploymentEnv } from './env.ts';
import { fallbackLang, type Lang } from './i18n.ts';
import {
  type DeliveryStatus,
  findNotification,
  type LoggedNotification,
  logNotification,
  type NotificationKind,
  type NotificationMessages,
  type NotificationText,
  outstandingDeliveries,
  recordDeliveries,
} from './notificationLog.ts';
import type { OwnedSite } from './ownerAccess.ts';
import type { Site } from './site.ts';
import { siteIconUrl } from './siteMeta.ts';
import { defaultNotificationTitle, type ParseResult, type SiteSettingsError, toErrors } from './siteSettings.ts';
import { deleteSubscriptionsByEndpoint } from './subscription.ts';

/**
 * Sends a Notification to every Subscription of one Site: logs it (see
 * notificationLog.ts), builds the payload the service worker (public/sw.js)
 * shows, picks each Subscription's language, sends in batches, records what
 * became of each Delivery, and forgets endpoints the push service reports
 * gone. The push service sits behind a port: web-push in production
 * (webpush.ts), a recording fake in tests.
 */

export type PushOutcome = 'delivered' | 'gone' | 'failed';

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

export type PushService = {
  send(target: PushTarget, payload: string): Promise<PushOutcome>;
};

/** A Notification that passed every rule. Only parseNotification produces one. */
export type ValidNotification = {
  readonly messages: NotificationMessages;
} & z.$brand<'ValidNotification'>;

export type DeliveryResult = { sent: number; removed: number; total: number };

export type DeliveryOptions = {
  kind?: NotificationKind;
  /** How long one send may take before it counts as failed. */
  sendTimeoutMs?: number;
};

const TITLE_MAX = 100;
const BODY_MAX = 1000;
/** Sends in flight at once: enough for a fast send, few enough to stay inside a function's time and the push service's patience. */
const BATCH_SIZE = 20;
const SEND_TIMEOUT_MS = 10_000;

/** One Language's text: a body, and a title that is dropped when blank. */
const notificationTextSchema = z.pipe(
  z.strictObject({
    body: z.string().check(z.trim(), z.minLength(1), z.maxLength(BODY_MAX)),
    title: z.optional(z.string().check(z.trim(), z.maxLength(TITLE_MAX))),
  }),
  z.transform(({ body, title }): NotificationText => (title ? { title, body } : { body }))
);

/**
 * Parses `{ <lang>: { title?, body } }`, one entry or more among the Site's
 * languages. There is no URL to set: a Notification always opens the Site's
 * Address.
 */
export function parseNotification(messages: unknown, langs: readonly Lang[]): ParseResult<ValidNotification> {
  if (!isRecord(messages) || Object.keys(messages).length === 0) {
    return { ok: false, errors: [{ path: 'messages', code: 'required' }] };
  }
  const errors: SiteSettingsError[] = [];
  const parsed: Partial<Record<Lang, NotificationText>> = {};
  for (const [lang, raw] of Object.entries(messages)) {
    const path = `messages.${lang}`;
    if (!langs.includes(lang as Lang)) {
      errors.push({ path, code: 'invalidOption' });
      continue;
    }
    const result = notificationTextSchema.safeParse(raw);
    if (result.success) {
      parsed[lang as Lang] = result.data;
    } else {
      errors.push(
        ...toErrors(result.error.issues, raw).map((e) => ({ ...e, path: e.path ? `${path}.${e.path}` : path }))
      );
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { messages: parsed } as ValidNotification };
}

export async function deliverNotification(
  owned: OwnedSite,
  notification: ValidNotification,
  push: PushService,
  { kind = 'general', sendTimeoutMs = SEND_TIMEOUT_MS }: DeliveryOptions = {}
): Promise<DeliveryResult> {
  const id = await logNotification(owned.site.id, kind, notification.messages);
  return sendOutstanding(owned.site, id, notification.messages, push, sendTimeoutMs);
}

/** Sends what is outstanding on one of the Site's Notifications; null when there is nothing it may finish. */
export async function finishNotification(
  owned: OwnedSite,
  id: string,
  push: PushService
): Promise<DeliveryResult | null> {
  const notification = await findNotification(owned.site.id, id);
  if (!notification || !deliverySummary(notification, owned.site).finishable) {
    return null;
  }
  return sendOutstanding(owned.site, id, notification.messages, push, SEND_TIMEOUT_MS);
}

/**
 * What the log says of a Notification. A Birth notification is not finished
 * while the Site is Waiting: it would announce what the page no longer says.
 */
export function deliverySummary(
  { kind, deliveries }: LoggedNotification,
  site: Pick<Site, 'birth'>
): DeliveryResult & { finishable: boolean } {
  const count = (status: DeliveryStatus) => deliveries.filter((delivery) => delivery.status === status).length;
  const outstanding = count('pending') + count('failed') > 0;
  return {
    sent: count('delivered'),
    removed: count('gone'),
    total: deliveries.length,
    finishable: outstanding && (kind !== 'birth' || site.birth.born),
  };
}

/** The Birth notification still to finish, the newest if there were several. */
export function unfinishedBirth(
  notifications: LoggedNotification[],
  site: Pick<Site, 'birth'>
): LoggedNotification | null {
  return (
    notifications.find(
      (notification) => notification.kind === 'birth' && deliverySummary(notification, site).finishable
    ) ?? null
  );
}

async function sendOutstanding(
  site: Site,
  id: string,
  messages: NotificationMessages,
  push: PushService,
  sendTimeoutMs: number
): Promise<DeliveryResult> {
  const payloadFor = payloads(site, messages);
  const outstanding = await outstandingDeliveries(id);
  const lost = outstanding.filter((delivery) => !delivery.subscription).map((delivery) => delivery.id);
  if (lost.length > 0) {
    await recordInBatches(lost);
  }
  const reachable = outstanding.flatMap(({ id: deliveryId, subscription }) =>
    subscription ? [{ deliveryId, subscription }] : []
  );

  const goneEndpoints = new Set<string>();
  for (let start = 0; start < reachable.length; start += BATCH_SIZE) {
    const batch = reachable.slice(start, start + BATCH_SIZE);
    const outcomes = await Promise.all(
      batch.map(({ subscription: s }) =>
        withinTime(push.send({ endpoint: s.endpoint, keys: s.keys }, payloadFor(s.lang ?? null)), sendTimeoutMs)
      )
    );
    const recorded = new Map<DeliveryStatus, number[]>();
    outcomes.forEach((outcome, i) => {
      recorded.set(outcome, [...(recorded.get(outcome) ?? []), batch[i].deliveryId]);
      if (outcome === 'gone') {
        goneEndpoints.add(batch[i].subscription.endpoint);
      }
    });
    await recordDeliveries(recorded);
  }
  for (const endpoint of goneEndpoints) {
    await deleteSubscriptionsByEndpoint(endpoint);
  }
  const logged = await findNotification(site.id, id);
  if (!logged) {
    throw new Error(`Notification ${id} left the log while sending`);
  }
  const { sent, removed, total } = deliverySummary(logged, site);
  return { sent, removed, total };
}

async function recordInBatches(ids: number[]): Promise<void> {
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    await recordDeliveries(new Map([['gone', ids.slice(start, start + BATCH_SIZE)]]));
  }
}

/** Waits for one send, but no longer than `ms`: a batch goes at the pace of its slowest endpoint. */
async function withinTime(send: Promise<PushOutcome>, ms: number): Promise<PushOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<PushOutcome>((resolve) => {
    timer = setTimeout(() => resolve('failed'), ms);
  });
  try {
    return await Promise.race([send, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One payload per language, built once. A Subscription gets its own
 * language's text, else the text in the Site's fallback Language (see
 * fallbackLang), else any text sent.
 */
function payloads(site: Site, messages: NotificationMessages): (lang: Lang | null) => string {
  const texts = messages;
  const fallback = texts[fallbackLang(site.languages)] ?? Object.values(texts)[0];
  const built = new Map<Lang | null, string>();
  const address = siteAddressPath(site.slug, addressEnv());
  const icon = notificationIcon(site, address);
  return (lang) => {
    let payload = built.get(lang);
    if (payload === undefined) {
      const text = (lang && texts[lang]) || fallback;
      payload = JSON.stringify({
        title: text?.title || defaultNotificationTitle(site),
        body: text?.body,
        icon,
        url: address,
        tag: `site-${site.slug}`,
      });
      built.set(lang, payload);
    }
    return payload;
  };
}

/**
 * The picture beside the text: the birth photo once the baby is born, else the
 * Site icon, which is the loading baby unless the Owner picked an emoji.
 */
export function notificationIcon(site: Site, address: string): string {
  const photo = site.birth.details?.photo;
  if (site.birth.born && photo) {
    return birthMediaUrl(site.slug, 'photo', photo, deploymentEnv().appEnv);
  }
  return siteIconUrl(site, '192', address.replace(/\/$/, ''));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
