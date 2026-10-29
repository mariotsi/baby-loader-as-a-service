import { AwsClient } from 'aws4fetch';
import { mediaStorageEnv } from './env.ts';
import type { OwnedSite } from './ownerAccess.ts';

const IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 50 * 1024 * 1024;
const MEDIA_TYPE_LIMITS: Record<string, number> = {
  'image/avif': IMAGE_LIMIT_BYTES,
  'image/jpeg': IMAGE_LIMIT_BYTES,
  'image/png': IMAGE_LIMIT_BYTES,
  'image/webp': IMAGE_LIMIT_BYTES,
  'video/mp4': VIDEO_LIMIT_BYTES,
  'video/webm': VIDEO_LIMIT_BYTES,
};

export interface MediaUpload {
  site: OwnedSite;
  file: Blob;
}

export interface StoredMedia {
  key: string;
  url: string;
}

/** The media storage seam used by future Site media features. */
export interface StorageProvider {
  /** Stores Owner media under customer-data/<owner>/<site> and returns its key and public URL. */
  upload(input: MediaUpload): Promise<StoredMedia>;
  /** Deletes only media in this Owner's Site folder and purges its URL; purge failure occurs after deletion. */
  delete(site: OwnedSite, key: string): Promise<void>;
  publicUrl(key: string): string;
}

export class UnsupportedMediaTypeError extends Error {}
export class MediaTooLargeError extends Error {}
export class MediaCachePurgeError extends Error {}
export class MediaOwnershipError extends Error {}
export class InvalidMediaKeyError extends Error {}

const CUSTOMER_DATA_PREFIX = 'customer-data';
const WEBSITE_ASSETS_PREFIX = 'website-assets';

/** Builds the folder used for uploaded media owned by a Site's Owner. */
export function customerMediaPrefix(site: OwnedSite): string {
  return `${CUSTOMER_DATA_PREFIX}/${site.owner.id}/${site.site.id}/`;
}

/** Builds a safe key for an application-managed website asset. */
export function websiteAssetKey(path: string): string {
  validateRelativePath(path);
  return `${WEBSITE_ASSETS_PREFIX}/${path}`;
}

function validateMedia(file: Blob): void {
  const limit = MEDIA_TYPE_LIMITS[file.type];
  if (!limit) {
    throw new UnsupportedMediaTypeError('This media type is not supported.');
  }
  if (file.size === 0 || file.size > limit) {
    throw new MediaTooLargeError('This media file is empty or exceeds its size limit.');
  }
}

function validateKey(key: string): void {
  const [namespace, ...parts] = key.split('/');
  if (
    !key ||
    key.startsWith('/') ||
    ![CUSTOMER_DATA_PREFIX, WEBSITE_ASSETS_PREFIX].includes(namespace) ||
    parts.length === 0 ||
    parts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new InvalidMediaKeyError('Media keys must be relative object paths.');
  }
}

function validateRelativePath(path: string): void {
  if (!path || path.startsWith('/') || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Asset paths must be relative object paths.');
  }
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

class R2StorageProvider implements StorageProvider {
  private readonly client: AwsClient;

  constructor(private readonly config: NonNullable<ReturnType<typeof mediaStorageEnv>>) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: 'auto',
      retries: 2,
    });
  }

  async upload({ site, file }: MediaUpload): Promise<StoredMedia> {
    const key = `${customerMediaPrefix(site)}${crypto.randomUUID()}`;
    validateKey(key);
    validateMedia(file);
    const response = await this.client.fetch(this.objectUrl(key), {
      method: 'PUT',
      headers: {
        'content-type': file.type,
        'cache-control': 'public, max-age=31536000, immutable',
      },
      body: await file.arrayBuffer(),
    });
    if (!response.ok) {
      throw new Error(`Media upload failed with status ${response.status}.`);
    }
    return { key, url: this.publicUrl(key) };
  }

  async delete(site: OwnedSite, key: string): Promise<void> {
    validateKey(key);
    if (!key.startsWith(customerMediaPrefix(site))) {
      throw new MediaOwnershipError('This media does not belong to the authenticated Site Owner.');
    }
    const response = await this.client.fetch(this.objectUrl(key), { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`Media deletion failed with status ${response.status}.`);
    }
    await this.purge(this.publicUrl(key));
  }

  publicUrl(key: string): string {
    validateKey(key);
    return `${this.config.publicUrl}/${encodeKey(key)}`;
  }

  private objectUrl(key: string): string {
    const endpoint = this.config.endpoint.replace(/\/$/, '');
    return `${endpoint}/${encodeURIComponent(this.config.bucket)}/${encodeKey(key)}`;
  }

  private async purge(url: string): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.config.cachePurgeZoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.cachePurgeToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ files: [url] }),
      }
    );
    const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
    if (!response.ok || !result?.success) {
      throw new MediaCachePurgeError(
        `Media was deleted from storage, but its Cloudflare cache purge failed with status ${response.status}.`
      );
    }
  }
}

/** Returns the configured R2 provider. */
let provider: StorageProvider | undefined;
export function getStorageProvider(): StorageProvider {
  provider ??= new R2StorageProvider(mediaStorageEnv());
  return provider;
}
