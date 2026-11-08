import { publicPageCopy } from './copy/publicPage.ts';
import { fallbackLang, type Lang } from './i18n.ts';
import type { NotificationMessages } from './notificationLog.ts';
import { siteShortName } from './siteAppIdentity.ts';
import { siteIconUrl } from './siteMeta.ts';
import { defaultNotificationTitle, type SiteSettings } from './siteSettings.ts';

/**
 * What one Subscription's device shows for a Notification: the text in its
 * Language, the title when none was written, the picture beside it, and the
 * labels of its buttons. Pure and free of server imports, so the send form
 * and the Birth dialog preview exactly what delivery sends (see
 * notificationDelivery.ts, which adds the Address and the tag and does the
 * sending).
 */

export type NotificationSite = Pick<
  SiteSettings,
  'babyName' | 'birth' | 'privacy' | 'pageName' | 'languages' | 'icon' | 'theme'
>;

export type NotificationContent = {
  /** The Language the text is in: the Subscription's when the Notification has it, else the Site's fallback. */
  readonly lang: Lang;
  readonly title: string;
  readonly body: string;
  readonly icon: string;
  readonly actions: { readonly open: string; readonly dismiss: string };
};

/**
 * The content for a Subscription in `lang` (null when it predates the field).
 * A Notification without a title takes the baby's name where Privacy settings
 * show it, else the Site's name as a home screen writes it.
 */
export function notificationContent(
  site: NotificationSite,
  messages: NotificationMessages,
  lang: Lang | null,
  icon: string
): NotificationContent {
  const shown = shownLang(site, messages, lang);
  const text = messages[shown];
  const copy = publicPageCopy[shown];
  return {
    lang: shown,
    title: text?.title || defaultNotificationTitle(site) || siteShortName(site, shown),
    body: text?.body ?? '',
    icon,
    actions: { open: copy.notificationOpen, dismiss: copy.notificationDismiss },
  };
}

function shownLang(site: NotificationSite, messages: NotificationMessages, lang: Lang | null): Lang {
  if (lang && messages[lang]) {
    return lang;
  }
  const fallback = fallbackLang(site.languages);
  if (messages[fallback]) {
    return fallback;
  }
  return (Object.keys(messages)[0] as Lang | undefined) ?? fallback;
}

/**
 * The picture beside the text: the birth photo once the baby is born, else
 * the Site icon, which is the loading baby unless the Owner picked an emoji.
 * `bornPhotoUrl` is where the birth photo is served, or null when there is none.
 */
export function notificationIcon(
  site: Pick<SiteSettings, 'birth' | 'icon' | 'theme'>,
  address: string,
  bornPhotoUrl: string | null
): string {
  if (site.birth.born && bornPhotoUrl) {
    return bornPhotoUrl;
  }
  return siteIconUrl(site, '192', address.replace(/\/$/, ''));
}
