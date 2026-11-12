import type { PublicPageCopy, StepText } from './copy/publicPage.ts';
import { buildDeviceInfo } from './deviceInfo.ts';

/**
 * Notification support (see GLOSSARY.md): where a Visitor's device stands on
 * Notifications, and what the Public page tells the Visitor there. Decided
 * from plain facts about the device and its browser, so every rule runs in
 * the `unit` tests; the page gathers the facts and makes the browser's calls.
 * What the page says is named by its entry in the Public page's copy, so
 * this module speaks no language.
 */

/** The device as far as Notifications care. */
export interface SupportDevice {
  ios: boolean;
  android: boolean;
  chrome: boolean;
  /** Whether the page runs as an app opened from the Home Screen. */
  standalone: boolean;
  /** The iOS version, such as "18.0", or null off iOS or when the browser does not say. */
  iosVersion: string | null;
}

/** What the browser says of itself, beside its User-Agent. */
export interface BrowserFacts {
  /** Whether it has service workers and the Push API. */
  pushApis: boolean;
  /** Its Notification permission for the page; null where it has none to give. */
  permission: 'default' | 'granted' | 'denied' | null;
}

/**
 * Where a device stands: still being checked, unable to subscribe, blocked
 * by the Visitor, an iPhone that must first add the page to its Home Screen,
 * or able to subscribe and holding a Subscription or not.
 */
export type NotificationStatus =
  | 'checking'
  | 'unsupported'
  | 'denied'
  | 'ios-home-screen'
  | 'subscribed'
  | 'unsubscribed';

const CHROME_GUIDE = 'https://support.google.com/chrome/answer/3220216?co=GENIE.Platform%3DAndroid&hl=en';
const APPLE_HOME_SCREEN_GUIDE = 'https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios';
const APPLE_NOTIFICATION_GUIDE = 'https://support.apple.com/guide/iphone/change-notification-settings-iph7c3d96bab/ios';

/** The first iOS whose web apps receive Notifications. */
const IOS_MINIMUM = { major: 16, minor: 4 };

/** The device behind a User-Agent, running as an app from the Home Screen or not. */
export function supportDevice(userAgent: string, standalone: boolean): SupportDevice {
  const info = buildDeviceInfo(userAgent, {});
  const ios = !!info.os.name && /ios|ipados/i.test(info.os.name);
  return {
    ios,
    android: !!info.os.name && /android/i.test(info.os.name),
    chrome: !!info.browser.name && /chrome/i.test(info.browser.name),
    standalone,
    iosVersion: ios ? info.os.version : null,
  };
}

/**
 * Where the device stands before its browser is asked for a Subscription:
 * one of the statuses that stop it there, or 'supported', when only the
 * browser and the server can tell subscribed from not.
 */
export function supportOf(
  device: SupportDevice,
  browser: BrowserFacts
): 'unsupported' | 'ios-home-screen' | 'denied' | 'supported' {
  if (device.ios && device.iosVersion) {
    const [major = 0, minor = 0] = device.iosVersion.split('.').map(Number);
    if (major < IOS_MINIMUM.major || (major === IOS_MINIMUM.major && minor < IOS_MINIMUM.minor)) {
      return 'unsupported';
    }
  }
  // An iPhone offers the Push API only to a page opened from the Home Screen.
  if (device.ios && !device.standalone) {
    return 'ios-home-screen';
  }
  if (!browser.pushApis) {
    return 'unsupported';
  }
  return browser.permission === 'denied' ? 'denied' : 'supported';
}

type TextEntry = { [K in keyof PublicPageCopy]: PublicPageCopy[K] extends string ? K : never }[keyof PublicPageCopy];
type StepEntry = { [K in keyof PublicPageCopy]: PublicPageCopy[K] extends StepText ? K : never }[keyof PublicPageCopy];

/** What the page says of a status that stops the device from subscribing, as an entry of the Public page's copy. */
export function supportNotice(
  status: Exclude<NotificationStatus, 'subscribed' | 'unsubscribed'>,
  device: SupportDevice | null
): TextEntry {
  if (status === 'checking') {
    return 'checking';
  }
  if (status === 'ios-home-screen') {
    return 'iosHomeScreen';
  }
  if (status === 'denied') {
    if (device?.ios) {
      return 'iosDenied';
    }
    return device?.android && device.chrome ? 'androidDenied' : 'errorDenied';
  }
  if (device?.ios) {
    return 'iosVersion';
  }
  return device?.android && !device.chrome ? 'androidUnsupported' : 'errorUnsupported';
}

/** The guide the page links under its notice, with the copy entry that names it; null when there is none to offer. */
export function supportGuide(
  status: NotificationStatus,
  device: SupportDevice | null
): { href: string; label: TextEntry } | null {
  if (status === 'ios-home-screen') {
    return { href: APPLE_HOME_SCREEN_GUIDE, label: 'iosHomeScreenLink' };
  }
  if (status === 'denied' && device?.ios) {
    return { href: APPLE_NOTIFICATION_GUIDE, label: 'iosSettingsLink' };
  }
  if (status === 'denied' && device?.android && device.chrome) {
    return { href: CHROME_GUIDE, label: 'androidSettingsLink' };
  }
  return null;
}

/**
 * The steps that add the page to an iPhone's Home Screen, as entries of the
 * Public page's copy. Safari moved Share in iOS 26 and again in iOS 27, and
 * from iOS 26 asks whether the page opens as a web app. `numbered` for a
 * version whose Safari is known; any other gets the steps in general words.
 */
export function homeScreenSteps(device: SupportDevice | null): { numbered: boolean; steps: StepEntry[] } {
  const major = Number(device?.iosVersion?.split('.')[0]);
  const known = (major >= 16 && major <= 18) || major === 26 || major === 27;
  if (!known) {
    return { numbered: false, steps: ['iosStepsGeneric', 'iosOpenApp'] };
  }
  let share: StepEntry = 'iosShare';
  if (major === 26) {
    share = 'iosMenu26';
  } else if (major === 27) {
    share = 'iosMenu27';
  }
  return {
    numbered: true,
    steps: [
      'iosOpenSafari',
      share,
      'iosAddHome',
      ...(major >= 26 ? (['iosEnableApp'] as const) : []),
      'iosAdd',
      'iosOpenApp',
    ],
  };
}
