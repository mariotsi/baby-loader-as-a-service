import { siteAddressPath } from './address.ts';
import type { Lang } from './i18n.ts';
import type { OwnedSite } from './ownerAccess.ts';
import type { Site } from './site.ts';
import { defaultNotificationTitle, type ParseResult, type SiteSettingsError } from './siteSettings.ts';
import { deleteSubscriptionsByEndpoint, listSubscriptionsBySite } from './subscription.ts';

/**
 * Sends a Notification to every Subscription of one Site: builds the payload
 * the service worker (public/sw.js) shows, picks each Subscription's
 * language, sends in batches, and forgets endpoints the push service reports
 * gone. The push service sits behind a port: web-push in production
 * (webpush.ts), a recording fake in tests.
 */

export type PushOutcome = 'delivered' | 'gone' | 'failed';

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

export type PushService = {
  send(target: PushTarget, payload: string): Promise<PushOutcome>;
};

export type NotificationText = { title?: string; body: string };

declare const valid: unique symbol;

/** A Notification that passed every rule. Only parseNotification produces one. */
export type ValidNotification = {
  readonly messages: Partial<Record<Lang, NotificationText>>;
  readonly [valid]: true;
};

export type DeliveryResult = { sent: number; removed: number; total: number };

const TITLE_MAX = 100;
const BODY_MAX = 1000;
/** Sends in flight at once: enough for a fast send, few enough to stay inside a function's time and the push service's patience. */
const BATCH_SIZE = 20;

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
    const text = parseText(raw, path, errors);
    if (text) {
      parsed[lang as Lang] = text;
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { messages: parsed } as ValidNotification };
}

function parseText(raw: unknown, path: string, errors: SiteSettingsError[]): NotificationText | null {
  if (!isRecord(raw)) {
    errors.push({ path, code: 'invalidType' });
    return null;
  }
  const before = errors.length;
  for (const key of Object.keys(raw)) {
    if (key !== 'title' && key !== 'body') {
      errors.push({ path: `${path}.${key}`, code: 'unknownField' });
    }
  }
  const body = trimmed(raw.body, `${path}.body`, BODY_MAX, errors);
  if (body === '') {
    errors.push({ path: `${path}.body`, code: 'required' });
  }
  const title = raw.title === undefined ? '' : trimmed(raw.title, `${path}.title`, TITLE_MAX, errors);
  if (errors.length > before || body === null) {
    return null;
  }
  return title ? { title, body } : { body };
}

/** The trimmed string, '' when absent, or null after recording why it is not acceptable. */
function trimmed(value: unknown, path: string, max: number, errors: SiteSettingsError[]): string | null {
  if (value === undefined) {
    return '';
  }
  if (typeof value !== 'string') {
    errors.push({ path, code: 'invalidType' });
    return null;
  }
  const text = value.trim();
  if (text.length > max) {
    errors.push({ path, code: 'tooLong', params: { max } });
    return null;
  }
  return text;
}

export async function deliverNotification(
  owned: OwnedSite,
  notification: ValidNotification,
  push: PushService
): Promise<DeliveryResult> {
  const { site } = owned;
  const payloadFor = payloads(site, notification);
  const subscriptions = await listSubscriptionsBySite(site._id);

  let sent = 0;
  const gone = new Set<string>();
  for (let start = 0; start < subscriptions.length; start += BATCH_SIZE) {
    const batch = subscriptions.slice(start, start + BATCH_SIZE);
    const outcomes = await Promise.all(
      batch.map((s) => push.send({ endpoint: s.endpoint, keys: s.keys }, payloadFor(s.lang ?? null)))
    );
    outcomes.forEach((outcome, i) => {
      if (outcome === 'delivered') {
        sent += 1;
      } else if (outcome === 'gone') {
        gone.add(batch[i].endpoint);
      }
    });
  }
  for (const endpoint of gone) {
    await deleteSubscriptionsByEndpoint(endpoint);
  }
  return { sent, removed: gone.size, total: subscriptions.length };
}

/**
 * One payload per language, built once. A Subscription gets its own
 * language's text, else the Site's primary language's, else any text sent.
 */
function payloads(site: Site, notification: ValidNotification): (lang: Lang | null) => string {
  const primary = site.languages[0];
  const texts = notification.messages;
  const fallback = texts[primary] ?? Object.values(texts)[0];
  const built = new Map<Lang | null, string>();
  return (lang) => {
    let payload = built.get(lang);
    if (payload === undefined) {
      const text = (lang && texts[lang]) || fallback;
      payload = JSON.stringify({
        title: text?.title || defaultNotificationTitle(site),
        body: text?.body,
        url: siteAddressPath(site.slug),
        tag: `site-${site.slug}`,
      });
      built.set(lang, payload);
    }
    return payload;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
