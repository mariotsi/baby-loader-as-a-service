import type { SiteSettings } from './siteSettings.ts';

export type PreviewState = 'waiting' | 'born';

/**
 * Site settings as the Public page would draw them in `state`, whatever state
 * the Site is in. A Waiting Site previews Born with today as the birth, no
 * invented numbers, and the name and sex showing, as announcing would leave them.
 */
export function settingsInState(settings: SiteSettings, state: PreviewState, now: Date = new Date()): SiteSettings {
  if (state === 'waiting') {
    return settings.birth.born
      ? {
          ...settings,
          birth: { born: false, details: null },
          milestones: settings.milestones.filter((milestone) => milestone.kind !== 'birth'),
        }
      : settings;
  }
  if (settings.birth.born) {
    return settings;
  }
  return {
    ...settings,
    birth: {
      born: true,
      details: { datetime: now.toISOString(), weightGrams: null, lengthCm: null, message: {} },
    },
    privacy: { showName: true, showSex: true },
  };
}
