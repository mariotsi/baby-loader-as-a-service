import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDeviceInfo, type DeviceInfo } from './deviceInfo.ts';

const UA = {
  iphoneSafari26:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneSafari17:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
  macSafari17:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  macSafari26:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  androidReduced:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36',
  androidReal:
    'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
};

const IPHONE_16 = { screenWidth: 393, screenHeight: 852, pixelRatio: 3 };

/** The fields that describe the device, without the volunteered hints. */
function device(info: DeviceInfo) {
  const { os, browser, deviceType, vendor, model, modelGuess, osVersionFrozen, label } = info;
  return { os, browser, deviceType, vendor, model, modelGuess, osVersionFrozen, label };
}

test('Safari 26 on iPhone: the frozen 18.6 becomes an estimate from Safari, the model a guess from the screen', () => {
  assert.deepEqual(device(buildDeviceInfo(UA.iphoneSafari26, IPHONE_16)), {
    os: { name: 'iOS', version: '26' },
    browser: { name: 'Mobile Safari', version: '26.0' },
    deviceType: 'mobile',
    vendor: 'Apple',
    model: 'iPhone',
    modelGuess: 'iPhone 14 Pro/15/15 Pro/16/16 Pro',
    osVersionFrozen: true,
    label: 'iPhone 14 Pro/15/15 Pro/16/16 Pro · iOS 26+ (estimated) · Mobile Safari 26.0',
  });
});

test('Safari before 26 on iPhone reports the real iOS version; landscape screens guess the same model', () => {
  const info = buildDeviceInfo(UA.iphoneSafari17, { screenWidth: 852, screenHeight: 393, pixelRatio: 3 });
  assert.deepEqual(info.os, { name: 'iOS', version: '17.4' });
  assert.equal(info.osVersionFrozen, false);
  assert.equal(info.modelGuess, 'iPhone 14 Pro/15/15 Pro/16/16 Pro');
});

test('Chrome on iPhone is not frozen: only Safari hides the iOS version', () => {
  const info = buildDeviceInfo(UA.iphoneChrome, IPHONE_16);
  assert.deepEqual(info.os, { name: 'iOS', version: '18.6' });
  assert.equal(info.osVersionFrozen, false);
  assert.equal(info.label, 'iPhone 14 Pro/15/15 Pro/16/16 Pro · iOS 18.6 · Chrome 141.0.0.0');
});

test('macOS 10.15 is a placeholder for every browser; only Safari 26+ gives an estimate', () => {
  assert.equal(
    buildDeviceInfo(UA.macSafari17, {}).label,
    'Apple Macintosh · Mac OS (version hidden by Apple) · Safari 17.4'
  );
  assert.equal(buildDeviceInfo(UA.macSafari26, {}).label, 'Apple Macintosh · Mac OS 26+ (estimated) · Safari 26.0');
  const chrome = buildDeviceInfo(UA.macChrome, {});
  assert.deepEqual(chrome.os, { name: 'Mac OS', version: null });
  assert.equal(chrome.osVersionFrozen, true);
  assert.equal(chrome.label, 'Apple Macintosh · Mac OS (version hidden by Apple) · Chrome 151.0.0.0');
});

test('Android UA Reduction: the "K" model and frozen "10" are dropped', () => {
  assert.deepEqual(device(buildDeviceInfo(UA.androidReduced, {})), {
    os: { name: 'Android', version: null },
    browser: { name: 'Chrome', version: '151.0.0.0' },
    deviceType: 'mobile',
    vendor: null,
    model: null,
    modelGuess: null,
    osVersionFrozen: false,
    label: 'Mobile · Android · Chrome 151.0.0.0',
  });
});

test('Android Client Hints restore the real model and OS version; an empty model is no model', () => {
  const hinted = buildDeviceInfo(UA.androidReduced, { chModel: 'Pixel 9', chPlatformVersion: '15.0.0' });
  assert.equal(hinted.model, 'Pixel 9');
  assert.equal(hinted.os.version, '15.0.0');
  assert.equal(hinted.label, 'Pixel 9 · Android 15.0.0 · Chrome 151.0.0.0');
  assert.equal(buildDeviceInfo(UA.androidReduced, { chModel: '' }).model, null);
});

test('an unreduced Android UA keeps its vendor, model and version', () => {
  assert.equal(buildDeviceInfo(UA.androidReal, {}).label, 'Samsung SM-S911B · Android 13 · Chrome 116.0.0.0');
});

test('desktop browsers without a model are labelled by OS and browser', () => {
  assert.equal(buildDeviceInfo(UA.windowsFirefox, null).label, 'Windows 10 · Firefox 140.0');
});

test('no User-Agent and hints that are not an object give an unknown desktop device', () => {
  const info = buildDeviceInfo(null, 'not an object');
  assert.equal(info.deviceType, 'desktop');
  assert.equal(info.label, 'Unknown device');
  assert.equal(info.ua, null);
  assert.equal(info.screen, null);
});

test('volunteered hints are clamped, clipped or dropped', () => {
  const info = buildDeviceInfo(UA.windowsFirefox, {
    screenWidth: 99999,
    screenHeight: -5,
    pixelRatio: 2.34567,
    viewportWidth: '800',
    timezone: 'x'.repeat(80),
    colorScheme: 'blue',
    hardwareConcurrency: 1000,
    deviceMemory: 8,
    touchPoints: 5.6,
    connectionType: 42,
    platform: 'MacIntel',
  });
  assert.deepEqual(info.screen, { width: 20000, height: 0, pixelRatio: 2.35 });
  assert.equal(info.viewport, null);
  assert.equal(info.timezone?.length, 60);
  assert.equal(info.colorScheme, null);
  assert.equal(info.hardwareConcurrency, 128);
  assert.equal(info.deviceMemory, 8);
  assert.equal(info.touchPoints, 6);
  assert.equal(info.connectionType, null);
  assert.equal(info.platform, 'MacIntel');
  assert.equal(info.engine, 'Gecko');
  assert.equal(buildDeviceInfo('x'.repeat(600), {}).ua?.length, 512);
});
