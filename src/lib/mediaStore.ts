/**
 * Where media files live: the deployment's R2 bucket, reached through its
 * binding, or a map in memory for tests. Site media (siteMedia.ts) and the
 * website assets route are its only callers; neither knows which one it has.
 */

/** A stored file, or the byte range of it a request asked for. */
export interface MediaObject {
  body: ReadableStream<Uint8Array>;
  size: number;
  contentType: string | null;
  etag: string;
  /** The bytes `body` holds when the request asked for a range. */
  range: { offset: number; length: number } | null;
}

export interface MediaStore {
  put(key: string, file: Blob): Promise<void>;
  /** The file, or the range the request's `Range` header names; null when there is none. */
  get(key: string, request?: Headers): Promise<MediaObject | null>;
  delete(key: string): Promise<void>;
  /** Every file under `prefix`, with when it was stored. */
  list(prefix: string): Promise<{ key: string; uploaded: Date }[]>;
}

/** Drops a public URL from the CDN cache, so a deleted file stops being served. */
export type CachePurge = (url: string) => Promise<void>;

/** For a store no cache sits in front of, as in development and tests. */
export const noCachePurge: CachePurge = () => Promise.resolve();

/** The media domain caches each file for a year, under its own random key. */
const IMMUTABLE = 'public, max-age=31536000, immutable';

type R2Range = { offset?: number; length?: number } | { suffix: number };

/** The part of the Workers runtime's R2Bucket this store uses. */
export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer,
    options: { httpMetadata: { contentType: string; cacheControl: string } }
  ): Promise<unknown>;
  get(
    key: string,
    options?: { range: Headers }
  ): Promise<{
    body?: ReadableStream<Uint8Array>;
    size: number;
    httpEtag: string;
    httpMetadata?: { contentType?: string };
    range?: R2Range;
  } | null>;
  delete(key: string): Promise<void>;
  list(options: {
    prefix: string;
    cursor?: string;
  }): Promise<
    { objects: { key: string; uploaded: Date }[] } & ({ truncated: true; cursor: string } | { truncated: false })
  >;
}

/** The R2 bucket bound to this Worker. */
export function r2MediaStore(bucket: R2BucketLike): MediaStore {
  return {
    async put(key, file) {
      await bucket.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type, cacheControl: IMMUTABLE },
      });
    },
    async get(key, request) {
      const object = await bucket.get(key, request ? { range: request } : undefined);
      if (!object?.body) {
        return null;
      }
      return {
        body: object.body,
        size: object.size,
        contentType: object.httpMetadata?.contentType ?? null,
        etag: object.httpEtag,
        range: object.range ? byteRange(object.range, object.size) : null,
      };
    },
    async delete(key) {
      await bucket.delete(key);
    },
    async list(prefix) {
      const found: { key: string; uploaded: Date }[] = [];
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ prefix, cursor });
        found.push(...page.objects.map(({ key, uploaded }) => ({ key, uploaded })));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return found;
    },
  };
}

function byteRange(range: R2Range, size: number): { offset: number; length: number } {
  if ('suffix' in range) {
    const length = Math.min(range.suffix, size);
    return { offset: size - length, length };
  }
  const offset = range.offset ?? 0;
  const length = range.length ?? size - offset;
  return { offset, length };
}

/** A store in memory, for tests; `now` stamps each file as it is stored. */
export function memoryMediaStore(now: () => Date = () => new Date()) {
  const files = new Map<string, { bytes: Uint8Array<ArrayBuffer>; contentType: string; uploaded: Date }>();
  const store: MediaStore = {
    async put(key, file) {
      files.set(key, { bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type, uploaded: now() });
    },
    get(key, request) {
      const file = files.get(key);
      if (!file) {
        return Promise.resolve(null);
      }
      const size = file.bytes.length;
      const range = parseRange(request?.get('range') ?? null, size);
      const bytes = range ? file.bytes.slice(range.offset, range.offset + range.length) : file.bytes;
      return Promise.resolve({
        body: new Blob([bytes]).stream(),
        size,
        contentType: file.contentType,
        etag: `"${key}"`,
        range,
      });
    },
    delete(key) {
      files.delete(key);
      return Promise.resolve();
    },
    list(prefix) {
      return Promise.resolve(
        [...files].filter(([key]) => key.startsWith(prefix)).map(([key, { uploaded }]) => ({ key, uploaded }))
      );
    },
  };
  return { store, keys: () => [...files.keys()] };
}

/** A single `bytes=` range, as R2 reads one. */
function parseRange(header: string | null, size: number): { offset: number; length: number } | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) {
    return null;
  }
  if (!match[1]) {
    const length = Math.min(Number(match[2]), size);
    return { offset: size - length, length };
  }
  const offset = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return { offset, length: end - offset + 1 };
}

/** Purges through Cloudflare's API, in the zone that serves the media domain. */
export function cloudflareCachePurge({ zoneId, token }: { zoneId: string; token: string }): CachePurge {
  return async (url) => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ files: [url] }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
    if (!response.ok || !result?.success) {
      throw new Error(`The Cloudflare cache purge failed with status ${response.status}.`);
    }
  };
}

/** A response serving `object`, a 206 with its Content-Range when it is a range. */
export function mediaResponse(object: MediaObject, cacheControl: string): Response {
  const headers = new Headers({
    ETag: object.etag,
    'Cache-Control': cacheControl,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  });
  if (object.contentType) {
    headers.set('Content-Type', object.contentType);
  }
  if (object.range) {
    const { offset, length } = object.range;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { headers });
}
