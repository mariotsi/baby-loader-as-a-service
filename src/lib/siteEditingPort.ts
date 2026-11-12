import { type BirthFields, withBirth } from './birthAnnouncement.ts';
import type { DeliveryResult } from './notificationDelivery.ts';
import type { Site } from './site.ts';
import type { SaveFailure, SiteEditingPort, Written } from './siteEditing.ts';
import { type BirthMedia, parseSiteSettings, siteSettingsOf } from './siteSettings.ts';

/**
 * The two adapters of Site editing's port: the Platform's routes over
 * `fetch`, which the editor runs on, and a Site held in memory, which tests
 * and stories run on.
 */

/** The Site settings, Birth and media routes of the Site at `slug`. */
export function fetchSiteEditingPort(slug: string): SiteEditingPort {
  const site = `/api/sites/${slug}`;

  /** What a route answered: the saved Site, or why not. No answer, or one that is not JSON, is a refusal with no error. */
  async function answered(request: Promise<Response>): Promise<Written | SaveFailure> {
    const res = await request.catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok && data?.site) {
      return { ok: true, site: data.site, notification: data.notification ?? null };
    }
    if (res?.status !== 409 && data?.errors) {
      return { ok: false, errors: data.errors };
    }
    return { ok: false, refused: data?.error, stale: res?.status === 409 };
  }

  function json(method: string, body: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  return {
    saveSettings: (body) => answered(fetch(site, json('PUT', body))),
    setBirth: (body) => answered(fetch(`${site}/birth`, json('PUT', body))),
    clearBirth: (body) => answered(fetch(`${site}/birth`, json('DELETE', body))),
    async upload(file) {
      const body = new FormData();
      body.set('file', file);
      const res = await fetch(`${site}/media`, { method: 'POST', body }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (!res?.ok || !data?.media) {
        return { ok: false, refused: data?.error };
      }
      return { ok: true, media: { ...data.media, name: file.name, type: file.type, size: file.size } };
    },
  };
}

/** Site editing's port on a Site held in memory, with the handles a test or a story steers it by. */
export interface MemorySiteEditingPort extends SiteEditingPort {
  /** The Site as the port last saved it. */
  site(): Site;
  /** Every call the port took, in order: 'saveSettings', 'setBirth', 'clearBirth' or 'upload'. */
  calls: string[];
  /** Saves a change from another tab: the next save from this one is stale. */
  changeElsewhere(): void;
  /** Answers the next call with `failure`, saving nothing. */
  refuseNext(failure: SaveFailure): void;
  /** Keeps the next save waiting until the returned function is called. */
  holdNext(): () => void;
}

/**
 * A Site saved in memory by the rules the routes save by: the same parse, the
 * Birth set and cleared with `withBirth`, and a save refused as stale when
 * `updatedAt` is not the Site's. Announcing answers `notification`.
 */
export function memorySiteEditingPort(
  start: Site,
  { notification = { sent: 1, removed: 0, total: 1 }, now = () => new Date() }: MemoryOptions = {}
): MemorySiteEditingPort {
  let site = start;
  let saves = 0;
  let refusal: SaveFailure | null = null;
  let gate: Promise<void> | null = null;
  const calls: string[] = [];

  function touch() {
    saves += 1;
    site = { ...site, updatedAt: new Date(Date.parse(start.updatedAt) + saves * 1000).toISOString() };
  }

  async function write(
    call: string,
    updatedAt: string,
    next: unknown,
    announces = false
  ): Promise<Written | SaveFailure> {
    calls.push(call);
    const waiting = gate;
    gate = null;
    await waiting;
    if (refusal) {
      const failure = refusal;
      refusal = null;
      return failure;
    }
    if (updatedAt !== site.updatedAt) {
      return { ok: false, refused: { code: 'staleSite' }, stale: true };
    }
    const checked = parseSiteSettings(next, now());
    if (!checked.ok) {
      return { ok: false, errors: checked.errors };
    }
    site = { ...site, ...checked.value };
    touch();
    return { ok: true, site, notification: announces ? notification : null };
  }

  return {
    site: () => site,
    calls,
    changeElsewhere: touch,
    refuseNext(failure) {
      refusal = failure;
    },
    holdNext() {
      let release = () => {};
      gate = new Promise((resolve) => {
        release = resolve;
      });
      return release;
    },
    saveSettings: ({ updatedAt, settings }) => write('saveSettings', updatedAt, { ...settings, birth: site.birth }),
    setBirth: ({ updatedAt, ...fields }) =>
      write('setBirth', updatedAt, withBirth(siteSettingsOf(site), fields as unknown as BirthFields), !site.birth.born),
    clearBirth: ({ updatedAt }) => write('clearBirth', updatedAt, withBirth(siteSettingsOf(site), null)),
    upload(file) {
      calls.push('upload');
      if (refusal && 'refused' in refusal) {
        const { refused } = refusal;
        refusal = null;
        return Promise.resolve({ ok: false, refused });
      }
      const key = `customer-data/${site.ownerId}/${site.id}/${crypto.randomUUID()}`;
      const media = { key, url: `https://media.example/${key}`, name: file.name, type: file.type, size: file.size };
      return Promise.resolve({ ok: true, media: media as BirthMedia });
    },
  };
}

interface MemoryOptions {
  /** How the Birth notification goes when a save announces the birth. */
  notification?: DeliveryResult | 'failed';
  now?: () => Date;
}
