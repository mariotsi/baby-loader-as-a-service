import type { KyInstance } from 'ky';
import { type BirthFields, withBirth } from './birthAnnouncement.ts';
import type { DeliveryResult } from './notificationDelivery.ts';
import { platformApi, refusalOf, refusedStatus } from './platformApi.ts';
import type { Site } from './site.ts';
import type { SaveFailure, SiteEditingPort, Written } from './siteEditing.ts';
import { type BirthMedia, parseSiteSettings, type SiteSettingsError, siteSettingsOf } from './siteSettings.ts';

/**
 * The two adapters of Site editing's port: the Platform's routes through
 * `platformApi`, which the editor runs on, and a Site held in memory, which tests
 * and stories run on.
 */

/** The Site settings, Birth and media routes of the Site at `slug`, through `api` (the Platform's routes unless a test passes its own). */
export function fetchSiteEditingPort(slug: string, api: KyInstance = platformApi): SiteEditingPort {
  const site = `sites/${slug}`;

  /** What a route answered: the saved Site, or why not. No answer, or one that is not JSON, is a refusal with no error. */
  async function answered(request: () => Promise<Partial<Written>>): Promise<Written | SaveFailure> {
    try {
      const { site: saved, notification } = await request();
      if (saved) {
        return { ok: true, site: saved, notification: notification ?? null };
      }
      return { ok: false, refused: undefined, stale: false };
    } catch (error) {
      const refusal = refusalOf(error) as { error?: unknown; errors?: SiteSettingsError[] } | null;
      const status = refusedStatus(error);
      if (status !== 409 && refusal?.errors) {
        return { ok: false, errors: refusal.errors };
      }
      return { ok: false, refused: refusal?.error, stale: status === 409 };
    }
  }

  return {
    saveSettings: (json) => answered(() => api.put(site, { json }).json()),
    setBirth: (json) => answered(() => api.put(`${site}/birth`, { json }).json()),
    clearBirth: (json) => answered(() => api.delete(`${site}/birth`, { json }).json()),
    async upload(file) {
      const body = new FormData();
      body.set('file', file);
      try {
        const { media } = await api.post(`${site}/media`, { body }).json<{ media?: BirthMedia }>();
        if (!media) {
          return { ok: false, refused: undefined };
        }
        // The browser knows the file's type; a type the route takes is one of BirthMedia's.
        return {
          ok: true,
          media: { ...media, name: file.name, type: file.type as BirthMedia['type'], size: file.size },
        };
      } catch (error) {
        return { ok: false, refused: (refusalOf(error) as { error?: unknown } | null)?.error };
      }
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
