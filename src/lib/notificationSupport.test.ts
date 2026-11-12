import { expect, test } from 'vitest';
import { type NamedControl, publicPageCopy, type StepText } from './copy/publicPage.ts';
import { LANGS } from './i18n.ts';
import {
  type BrowserFacts,
  homeScreenSteps,
  type SupportDevice,
  supportDevice,
  supportGuide,
  supportNotice,
  supportOf,
} from './notificationSupport.ts';

const iphoneSafari = (os: string, safari: string) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS ${os} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safari} Mobile/15E148 Safari/604.1`;
const UA = {
  iphone163: iphoneSafari('16_3', '16.3'),
  iphone164: iphoneSafari('16_4', '16.4'),
  iphone18: iphoneSafari('18_0', '18.0'),
  // From Safari 26 the User-Agent keeps iOS at 18.6, and the version is read from Safari's own.
  iphone26: iphoneSafari('18_6', '26.0'),
  iphone27: iphoneSafari('18_6', '27.0'),
  iphone28: iphoneSafari('18_6', '28.0'),
  androidChrome:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

const able: BrowserFacts = { pushApis: true, permission: 'default' };
const blocked: BrowserFacts = { pushApis: true, permission: 'denied' };
const without: BrowserFacts = { pushApis: false, permission: null };

const iphone = (version: string | null, standalone = false): SupportDevice => ({
  ios: true,
  android: false,
  chrome: false,
  standalone,
  iosVersion: version,
});
const android = (chrome: boolean): SupportDevice => ({
  ios: false,
  android: true,
  chrome,
  standalone: false,
  iosVersion: null,
});
const desktop: SupportDevice = { ios: false, android: false, chrome: true, standalone: false, iosVersion: null };

test('a User-Agent tells the device as far as Notifications care', () => {
  expect(supportDevice(UA.iphone18, false)).toStrictEqual(iphone('18.0'));
  expect(supportDevice(UA.iphone163, true)).toStrictEqual(iphone('16.3', true));
  expect(supportDevice(UA.iphone26, false).iosVersion).toBe('26');
  expect(supportDevice(UA.iphone27, false).iosVersion).toBe('27');
  expect(supportDevice(UA.androidChrome, false)).toStrictEqual(android(true));
  expect(supportDevice(UA.androidFirefox, false)).toStrictEqual(android(false));
  expect(supportDevice(UA.desktopChrome, false)).toStrictEqual(desktop);
});

test('an iPhone below iOS 16.4 cannot subscribe, whatever else is true of it', () => {
  expect(supportOf(iphone('16.3'), able)).toBe('unsupported');
  expect(supportOf(iphone('16.3', true), able)).toBe('unsupported');
  expect(supportOf(iphone('15.8', true), blocked)).toBe('unsupported');
});

test('an iPhone from iOS 16.4 must first add the page to its Home Screen', () => {
  for (const version of ['16.4', '17.0', '18.0', '26', '27', '28']) {
    expect(supportOf(iphone(version), without), version).toBe('ios-home-screen');
    expect(supportOf(iphone(version), blocked), version).toBe('ios-home-screen');
  }
  // An iPhone that does not say its version is taken as recent enough.
  expect(supportOf(iphone(null), without)).toBe('ios-home-screen');
});

test('a page opened from the Home Screen stands as any other browser does', () => {
  expect(supportOf(iphone('16.4', true), able)).toBe('supported');
  expect(supportOf(iphone('26', true), blocked)).toBe('denied');
  expect(supportOf(iphone('18.0', true), without)).toBe('unsupported');
});

test('off the iPhone, a browser without the Push API cannot subscribe, and one the Visitor blocked is denied', () => {
  for (const device of [android(true), android(false), desktop]) {
    expect(supportOf(device, able)).toBe('supported');
    expect(supportOf(device, { pushApis: true, permission: 'granted' })).toBe('supported');
    expect(supportOf(device, blocked)).toBe('denied');
    expect(supportOf(device, without)).toBe('unsupported');
  }
});

test('each status that stops a device says why in that device’s terms, with the guide that helps there', () => {
  const told = (status: Parameters<typeof supportNotice>[0], device: SupportDevice | null) => [
    supportNotice(status, device),
    supportGuide(status, device)?.label ?? null,
  ];
  expect(told('checking', null)).toStrictEqual(['checking', null]);
  expect(told('ios-home-screen', iphone('18.0'))).toStrictEqual(['iosHomeScreen', 'iosHomeScreenLink']);
  expect(told('denied', iphone('18.0', true))).toStrictEqual(['iosDenied', 'iosSettingsLink']);
  expect(told('denied', android(true))).toStrictEqual(['androidDenied', 'androidSettingsLink']);
  expect(told('denied', android(false))).toStrictEqual(['errorDenied', null]);
  expect(told('denied', desktop)).toStrictEqual(['errorDenied', null]);
  expect(told('unsupported', iphone('16.3'))).toStrictEqual(['iosVersion', null]);
  expect(told('unsupported', android(false))).toStrictEqual(['androidUnsupported', null]);
  expect(told('unsupported', android(true))).toStrictEqual(['errorUnsupported', null]);
  expect(told('unsupported', desktop)).toStrictEqual(['errorUnsupported', null]);
  expect(told('unsupported', null)).toStrictEqual(['errorUnsupported', null]);
});

test('a device that can subscribe is offered no guide', () => {
  expect(supportGuide('subscribed', iphone('18.0', true))).toBe(null);
  expect(supportGuide('unsubscribed', android(true))).toBe(null);
  for (const guide of [
    supportGuide('ios-home-screen', iphone('18.0')),
    supportGuide('denied', iphone('18.0', true)),
    supportGuide('denied', android(true)),
  ]) {
    expect(guide?.href).toMatch(/^https:\/\/support\.(apple|google)\.com\//);
  }
});

test('the Home Screen steps follow where Safari keeps Share in each iOS', () => {
  const classic = ['iosOpenSafari', 'iosShare', 'iosAddHome', 'iosAdd', 'iosOpenApp'];
  for (const version of ['16.4', '17.0', '18.0']) {
    expect(homeScreenSteps(iphone(version)), version).toStrictEqual({ numbered: true, steps: classic });
  }
  expect(homeScreenSteps(iphone('26'))).toStrictEqual({
    numbered: true,
    steps: ['iosOpenSafari', 'iosMenu26', 'iosAddHome', 'iosEnableApp', 'iosAdd', 'iosOpenApp'],
  });
  expect(homeScreenSteps(iphone('27.1'))).toStrictEqual({
    numbered: true,
    steps: ['iosOpenSafari', 'iosMenu27', 'iosAddHome', 'iosEnableApp', 'iosAdd', 'iosOpenApp'],
  });
});

test('an iOS whose Safari is not known gets the steps in general words', () => {
  const general = { numbered: false, steps: ['iosStepsGeneric', 'iosOpenApp'] };
  for (const device of [iphone('28'), iphone('19.0'), iphone(null), null]) {
    expect(homeScreenSteps(device)).toStrictEqual(general);
  }
});

const STEPS = [
  'iosStepsGeneric',
  'iosOpenApp',
  'iosOpenSafari',
  'iosShare',
  'iosMenu26',
  'iosMenu27',
  'iosAddHome',
  'iosEnableApp',
  'iosAdd',
] as const;

const controls = (step: StepText) => step.filter((part): part is NamedControl => typeof part !== 'string');

test('every language names the same controls, with the same icons in the same order, as English', () => {
  for (const lang of LANGS) {
    for (const entry of STEPS) {
      const icons = (text: StepText) => controls(text).map((control) => control.icon ?? null);
      expect(icons(publicPageCopy[lang][entry]), `${lang}.${entry}`).toStrictEqual(icons(publicPageCopy.en[entry]));
      for (const control of controls(publicPageCopy[lang][entry])) {
        expect(control.name.trim(), `${lang}.${entry}`).not.toBe('');
      }
    }
  }
  // The steps that carry an icon carry the one their control shows on the iPhone.
  expect(controls(publicPageCopy.en.iosMenu26).map((c) => c.icon)).toStrictEqual(['more', 'share', 'share']);
  expect(controls(publicPageCopy.en.iosMenu27).map((c) => c.icon)).toStrictEqual(['pageMenu', 'share', 'share']);
  expect(controls(publicPageCopy.en.iosAddHome).map((c) => c.icon)).toStrictEqual(['addToHome']);
  expect(controls(publicPageCopy.en.iosShare).map((c) => c.icon)).toStrictEqual(['share']);
});
