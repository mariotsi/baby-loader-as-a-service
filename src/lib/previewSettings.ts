import { withBirth } from './birthAnnouncement.ts';
import type { SiteSettings } from './siteSettings.ts';

export type PreviewState = 'waiting' | 'born';

/**
 * Site settings as the Public page would draw them in `state`, whatever state
 * the Site is in. A Waiting Site previews Born as announcing would leave it:
 * today as the birth, no invented numbers, and the Birth milestone.
 */
export function settingsInState(settings: SiteSettings, state: PreviewState, now: Date = new Date()): SiteSettings {
  if (state === 'waiting') {
    return settings.birth.born ? withBirth(settings, null) : settings;
  }
  if (settings.birth.born) {
    return settings;
  }
  return withBirth(settings, {
    babyName: settings.babyName,
    sex: settings.sex,
    details: { datetime: now.toISOString(), weightGrams: null, lengthCm: null, message: {} },
    birthVideo: settings.birthVideo,
  });
}
