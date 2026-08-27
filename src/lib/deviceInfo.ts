import { UAParser } from 'ua-parser-js';

// Hints the client can voluntarily report about itself. None of these need a
// permission prompt (unlike navigator.geolocation), so they're safe to send
// silently alongside the subscription.
export interface ClientDeviceHints {
  timezone?: unknown;
  screenWidth?: unknown;
  screenHeight?: unknown;
  pixelRatio?: unknown;
  viewportWidth?: unknown;
  viewportHeight?: unknown;
  platform?: unknown;
  hardwareConcurrency?: unknown;
  deviceMemory?: unknown;
  touchPoints?: unknown;
  colorScheme?: unknown;
  connectionType?: unknown;
  // High-entropy User-Agent Client Hints (Chromium only). Chrome 110+ freezes
  // the Android model to "K" and the OS version to "10" in the UA string, so
  // these are the only way to recover the real values.
  chModel?: unknown;
  chPlatformVersion?: unknown;
  chFullVersion?: unknown;
}

export interface DeviceInfo {
  ua: string | null;
  os: { name: string | null; version: string | null };
  browser: { name: string | null; version: string | null };
  engine: string | null;
  deviceType: string; // 'mobile' | 'tablet' | 'desktop' | ...
  vendor: string | null;
  model: string | null;
  modelGuess: string | null; // best-effort, see guessIphoneModel below
  // True when os.version is known-unreliable — see isAppleOsVersionFrozen below.
  osVersionFrozen: boolean;
  // Human-readable one-liner, e.g. "iPhone 14 Pro/15/15 Pro · iOS 17.4 · Safari 17.4"
  label: string;
  timezone: string | null;
  platform: string | null;
  screen: { width: number | null; height: number | null; pixelRatio: number | null } | null;
  viewport: { width: number | null; height: number | null } | null;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  touchPoints: number | null;
  colorScheme: 'light' | 'dark' | null;
  connectionType: string | null;
}

function clip(value: string | null | undefined, max = 100): string | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  return value.length > max ? value.slice(0, max) : value;
}

function clipUnknown(value: unknown, max = 100): string | null {
  return typeof value === 'string' ? clip(value, max) : null;
}

function clampInt(value: unknown, max = 100000): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(max, Math.round(value)));
}

function clampFloat(value: unknown, max = 20): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(Math.max(0, Math.min(max, value)) * 100) / 100;
}

// Best-effort iPhone model guess from CSS screen size + device pixel ratio.
// iOS Safari's User-Agent deliberately omits the specific model — Apple
// treats it as fingerprinting surface, so ua-parser-js only ever sees
// vendor="Apple", model="iPhone". Several generations share identical
// screen specs, so this can only narrow to a short list, never a single
// certain answer. w/h below are CSS points in portrait orientation
// (screen.width/height, smaller value first).
const IPHONE_SCREEN_TABLE: { w: number; h: number; ratio: number; models: string }[] = [
  { w: 320, h: 480, ratio: 2, models: 'iPhone 4/4s' },
  { w: 320, h: 568, ratio: 2, models: 'iPhone 5/5s/5c/SE (1st gen)' },
  { w: 375, h: 667, ratio: 2, models: 'iPhone 6/6s/7/8/SE (2nd/3rd gen)' },
  { w: 414, h: 736, ratio: 3, models: 'iPhone 6+/6s+/7+/8+' },
  { w: 375, h: 812, ratio: 3, models: 'iPhone X/XS/11 Pro or 12 mini/13 mini' },
  { w: 414, h: 896, ratio: 2, models: 'iPhone XR/11' },
  { w: 414, h: 896, ratio: 3, models: 'iPhone XS Max/11 Pro Max' },
  { w: 390, h: 844, ratio: 3, models: 'iPhone 12/12 Pro/13/13 Pro/14' },
  { w: 428, h: 926, ratio: 3, models: 'iPhone 12 Pro Max/13 Pro Max/14 Plus' },
  { w: 393, h: 852, ratio: 3, models: 'iPhone 14 Pro/15/15 Pro/16/16 Pro' },
  { w: 430, h: 932, ratio: 3, models: 'iPhone 14 Pro Max/15 Plus/15 Pro Max/16 Plus/16 Pro Max' },
  { w: 402, h: 874, ratio: 3, models: 'iPhone 16e' },
];

function guessIphoneModel(
  screenWidth: number | null,
  screenHeight: number | null,
  pixelRatio: number | null
): string | null {
  if (screenWidth === null || screenHeight === null || pixelRatio === null) {
    return null;
  }
  const w = Math.min(screenWidth, screenHeight);
  const h = Math.max(screenWidth, screenHeight);
  const match = IPHONE_SCREEN_TABLE.find(
    (entry) => entry.w === w && entry.h === h && Math.round(entry.ratio) === Math.round(pixelRatio)
  );
  return match ? match.models : null;
}

// Chrome 110+ (Feb 2023) applies "User-Agent Reduction" on Android: the real
// device model is replaced by the fixed placeholder "K" and the OS version by
// a frozen "10", for every device, across all Chromium browsers (Chrome,
// Edge, Opera, Samsung Internet). These carry no information at all, so we
// drop them instead of storing a model that looks real but isn't. The real
// values are only recoverable via high-entropy Client Hints (chModel /
// chPlatformVersion), which the client requests and sends separately.
const ANDROID_PLACEHOLDER_MODEL = 'K';
const ANDROID_FROZEN_OS_VERSION = '10';

function isAndroidPlaceholderModel(model: string | null, osName: string | null): boolean {
  return model === ANDROID_PLACEHOLDER_MODEL && !!osName && /android/i.test(osName);
}

// Starting with Safari 26 (shipped with iOS/iPadOS 26, Sept 2025), Apple
// freezes the OS version reported in Safari's User-Agent string at "18.6"
// (the last version before 26) to reduce fingerprinting — regardless of the
// device's real OS version. Only Safari itself does this: other iOS
// browsers (Chrome/Firefox/Edge) still report the real OS version, and
// ua-parser-js gives them a distinct browser name, so this check naturally
// only fires for actual Safari.
const IOS_FROZEN_UA_VERSION = '18.6';

// Desktop Safari has reported "Mac OS X 10_15_7" regardless of the real macOS
// version since Big Sur (2020) — much older and more permanent than the iOS
// freeze above, not something newly introduced by Safari 26. Unlike iOS,
// this one is NOT Safari-only: Chromium's own User-Agent Reduction reports
// the identical placeholder on macOS for Chrome/Edge/Brave/Opera too, so any
// browser can show it, confirmed against a real Chrome 151/macOS report.
const MACOS_FROZEN_UA_VERSION_PREFIX = '10.15';

/**
 * True when `osVersion` is one of Apple's known UA placeholders rather than
 * the device's real OS version.
 */
function isAppleOsVersionFrozen(osName: string | null, osVersion: string | null, browserName: string | null): boolean {
  if (!osName || !osVersion) {
    return false;
  }
  if (/ios|ipados/i.test(osName)) {
    // Only Safari freezes this on iOS/iPadOS; other iOS browsers still
    // report the real OS version.
    return !!browserName && /safari/i.test(browserName) && osVersion.startsWith(IOS_FROZEN_UA_VERSION);
  }
  if (/mac ?os/i.test(osName)) {
    return osVersion.startsWith(MACOS_FROZEN_UA_VERSION_PREFIX);
  }
  return false;
}

function buildLabel(input: {
  osName: string | null;
  osVersion: string | null;
  osVersionFrozen: boolean;
  browserName: string | null;
  browserVersion: string | null;
  deviceType: string;
  vendor: string | null;
  model: string | null;
  modelGuess: string | null;
}): string {
  const { osName, osVersion, osVersionFrozen, browserName, browserVersion, deviceType, vendor, model, modelGuess } =
    input;

  let deviceLabel: string | null = null;
  if (modelGuess) {
    deviceLabel = modelGuess;
  } else if (vendor && model) {
    deviceLabel = `${vendor} ${model}`;
  } else if (model) {
    deviceLabel = model;
  } else if (['mobile', 'tablet', 'wearable', 'console', 'smarttv'].includes(deviceType)) {
    deviceLabel = deviceType.charAt(0).toUpperCase() + deviceType.slice(1);
  }

  let osLabel: string | null = osName ? [osName, osVersion].filter(Boolean).join(' ') : null;
  if (osVersionFrozen && osLabel) {
    // osVersion has already been replaced upstream with Safari's major version,
    // which is an estimate rather than a value the device actually reported.
    osLabel = osVersion ? `${osLabel}+ (estimated)` : `${osLabel} (version hidden by Apple)`;
  }
  const browserLabel = browserName ? [browserName, browserVersion].filter(Boolean).join(' ') : null;

  return [deviceLabel, osLabel, browserLabel].filter(Boolean).join(' · ') || 'Unknown device';
}

/**
 * Builds a sanitized device/browser fingerprint from the request's
 * User-Agent (authoritative, can't be spoofed by editing the page) and
 * whatever extra client hints were volunteered (best-effort, capped in size
 * so an attacker can't stuff arbitrary data into the document).
 */
export function buildDeviceInfo(userAgent: string | null, rawHints: unknown): DeviceInfo {
  const parsed = new UAParser(userAgent ?? undefined).getResult();
  const h = (rawHints && typeof rawHints === 'object' ? rawHints : {}) as ClientDeviceHints;

  const screenWidth = clampInt(h.screenWidth, 20000);
  const screenHeight = clampInt(h.screenHeight, 20000);
  const viewportWidth = clampInt(h.viewportWidth, 20000);
  const viewportHeight = clampInt(h.viewportHeight, 20000);
  const pixelRatio = clampFloat(h.pixelRatio);

  const osName = clip(parsed.os.name);
  const browserName = clip(parsed.browser.name);
  const browserVersion = clip(parsed.browser.version, 30);
  const deviceType = clip(parsed.device.type) ?? 'desktop';
  const vendor = clip(parsed.device.vendor);

  // Client Hints (Chromium only) carry the real values Chrome's UA Reduction
  // strips out, so they take precedence over anything parsed from the UA.
  const chModel = clipUnknown(h.chModel, 100);
  const chPlatformVersion = clipUnknown(h.chPlatformVersion, 30);

  let model = chModel || clip(parsed.device.model);
  // Chrome sends "K" in the UA and, on some configurations, an empty string
  // via Client Hints. Neither identifies anything, so store nothing.
  if (isAndroidPlaceholderModel(model, osName) || model === '') {
    model = null;
  }

  let osVersion = clip(parsed.os.version, 30);
  const isAndroid = !!osName && /android/i.test(osName);
  if (isAndroid) {
    // Prefer the Client Hints value; otherwise drop the frozen "10", which is
    // a placeholder rather than the device's real Android version.
    if (chPlatformVersion) {
      osVersion = chPlatformVersion;
    } else if (osVersion === ANDROID_FROZEN_OS_VERSION) {
      osVersion = null;
    }
  }

  // Only worth guessing for iOS where the UA hides the real model; on
  // Android/others the model comes from Client Hints when available.
  const isIOS = !!osName && /ios|ipados/i.test(osName);
  const modelGuess = isIOS ? guessIphoneModel(screenWidth, screenHeight, pixelRatio) : null;

  const osVersionFrozen = isAppleOsVersionFrozen(osName, osVersion, browserName);
  if (osVersionFrozen) {
    // From version 26 onward Apple ships matching major version numbers across
    // iOS, iPadOS, macOS ("Tahoe") and Safari itself (Safari 26 <-> iOS/macOS
    // 26), and Safari's own version is NOT frozen — so its major is a far
    // better estimate of the real OS version than Apple's placeholder
    // ("18.6" on iOS/iPadOS, "10.15.7" on macOS). This alignment only holds
    // for Safari: a Chrome/Edge major number has no relationship to the OS
    // version at all, so non-Safari browsers always fall through to "unknown"
    // rather than showing a meaningless guess. Below Safari 26 there's no
    // such alignment either (e.g. Safari 17 shipped with macOS 14), so the
    // real version is left unknown rather than guessed.
    const isSafari = !!browserName && /safari/i.test(browserName);
    const browserMajor = isSafari && browserVersion ? parseInt(browserVersion, 10) : NaN;
    osVersion = Number.isFinite(browserMajor) && browserMajor >= 26 ? String(browserMajor) : null;
  }

  return {
    ua: clip(userAgent, 512),
    os: { name: osName, version: osVersion },
    browser: { name: browserName, version: browserVersion },
    engine: clip(parsed.engine.name),
    deviceType,
    vendor,
    model,
    modelGuess,
    osVersionFrozen,
    label: buildLabel({
      osName,
      osVersion,
      osVersionFrozen,
      browserName,
      browserVersion,
      deviceType,
      vendor,
      model,
      modelGuess,
    }),
    timezone: clipUnknown(h.timezone, 60),
    platform: clipUnknown(h.platform, 60),
    screen:
      screenWidth !== null || screenHeight !== null
        ? { width: screenWidth, height: screenHeight, pixelRatio }
        : null,
    viewport:
      viewportWidth !== null || viewportHeight !== null
        ? { width: viewportWidth, height: viewportHeight }
        : null,
    hardwareConcurrency: clampInt(h.hardwareConcurrency, 128),
    deviceMemory: clampFloat(h.deviceMemory, 1024),
    touchPoints: clampInt(h.touchPoints, 50),
    colorScheme: h.colorScheme === 'dark' || h.colorScheme === 'light' ? h.colorScheme : null,
    connectionType: clipUnknown(h.connectionType, 30),
  };
}
