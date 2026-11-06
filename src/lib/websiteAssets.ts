import type { AppEnv } from './appEnv.ts';
import { mediaFromPageOrigin } from './birthMedia.ts';

const MEDIA_ORIGINS: Record<Exclude<AppEnv, 'development'>, string> = {
  production: 'https://media.loading.baby',
  staging: 'https://media.staging-loading-baby.fyi',
  preview: 'https://media.staging-loading-baby.fyi',
};

const HOME_DECK_IMAGE = /^deck-[a-z0-9-]+\.[0-9a-f]{8}\.webp$/;

/** Whether a name is a website asset a Preview may fetch from its R2 bucket. */
export function isWebsiteAssetName(name: string): boolean {
  return name === 'born-placeholder-v1.png' || HOME_DECK_IMAGE.test(name);
}

export function websiteAssetUrl(path: string, appEnv: AppEnv): string {
  const assetPath = `/website-assets/${path}`;
  if (appEnv === 'development') {
    return assetPath;
  }
  if (mediaFromPageOrigin(appEnv)) {
    return `/api/website-assets/${path}`;
  }
  return `${MEDIA_ORIGINS[appEnv]}${assetPath}`;
}
