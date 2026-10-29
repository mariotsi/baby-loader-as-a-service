import type { AppEnv } from './appEnv.ts';

const MEDIA_ORIGINS: Record<Exclude<AppEnv, 'development'>, string> = {
  production: 'https://media.loading.baby',
  staging: 'https://media.staging-loading-baby.fyi',
  preview: 'https://media.staging-loading-baby.fyi',
};

export function websiteAssetUrl(path: string, appEnv: AppEnv): string {
  const assetPath = `/website-assets/${path}`;
  return appEnv === 'development' ? assetPath : `${MEDIA_ORIGINS[appEnv]}${assetPath}`;
}
