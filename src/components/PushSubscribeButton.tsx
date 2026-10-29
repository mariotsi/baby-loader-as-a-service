'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { buildDeviceInfo } from '@/lib/deviceInfo';
import type { Lang } from '@/lib/i18n';
import type { PushButtonCopy } from '@/lib/publicPageView';
import { decodeVapidKey, VapidKeyError } from '@/lib/vapid';
import styles from './PushSubscribeButton.module.css';

interface Props {
  slug: string;
  /** The Public page's current language, stored with the Subscription. */
  lang: Lang;
  vapidPublicKey: string | undefined;
  t: PushButtonCopy;
}

type Status = 'checking' | 'unsupported' | 'denied' | 'ios-home-screen' | 'subscribed' | 'unsubscribed';
type DeviceContext = {
  ios: boolean;
  android: boolean;
  chrome: boolean;
  standalone: boolean;
  iosVersion: string | null;
};
type HelpLink = { href: string; label: string };

const CHROME_GUIDE = 'https://support.google.com/chrome/answer/3220216?co=GENIE.Platform%3DAndroid&hl=en';
const APPLE_HOME_SCREEN_GUIDE = 'https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios';
const APPLE_NOTIFICATION_GUIDE = 'https://support.apple.com/guide/iphone/change-notification-settings-iph7c3d96bab/ios';
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, index) => ({
  id: `confetti-${index}`,
  left: `${(index * 43) % 100}%`,
  delay: `${(index % 8) * 0.08}s`,
}));

function deviceContext(): DeviceContext {
  const info = buildDeviceInfo(navigator.userAgent, {});
  const ios = !!info.os.name && /ios|ipados/i.test(info.os.name);
  const android = !!info.os.name && /android/i.test(info.os.name);
  return {
    ios,
    android,
    chrome: !!info.browser.name && /chrome/i.test(info.browser.name),
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    iosVersion: ios ? info.os.version : null,
  };
}

function statusNotice(status: Status, device: DeviceContext | null, t: PushButtonCopy): string {
  if (status === 'checking') {
    return t.checking;
  }
  if (status === 'ios-home-screen') {
    return t.iosHomeScreen;
  }
  if (status === 'denied') {
    if (device?.ios) {
      return t.iosDenied;
    }
    if (device?.android && device.chrome) {
      return t.androidDenied;
    }
    return t.errorDenied;
  }
  if (device?.ios) {
    return t.iosVersion;
  }
  if (device?.android && !device.chrome) {
    return t.androidUseChrome;
  }
  return t.errorUnsupported;
}

function statusHelpLink(status: Status, device: DeviceContext | null, t: PushButtonCopy): HelpLink | null {
  if (status === 'ios-home-screen') {
    return { href: APPLE_HOME_SCREEN_GUIDE, label: t.iosHomeScreenLink };
  }
  if (status === 'denied' && device?.ios) {
    return { href: APPLE_NOTIFICATION_GUIDE, label: t.iosSettingsLink };
  }
  if (status === 'denied' && device?.android && device.chrome) {
    return { href: CHROME_GUIDE, label: t.androidSettingsLink };
  }
  return null;
}

function StatusNotice({ status, device, t }: { status: Status; device: DeviceContext | null; t: PushButtonCopy }) {
  const link = statusHelpLink(status, device, t);
  return (
    <div className={styles.push}>
      <StatusMessage tone="info">{statusNotice(status, device, t)}</StatusMessage>
      {link ? (
        <a className={styles.helpLink} href={link.href} target="_blank" rel="noreferrer">
          {link.label}
        </a>
      ) : null}
    </div>
  );
}

function clientDeviceHints() {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    pixelRatio: window.devicePixelRatio,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    colorScheme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };
}

/** Where this browser stands with push notifications, before the Visitor does anything. */
async function detectStatus(device: DeviceContext): Promise<Status> {
  if (device.ios && device.iosVersion) {
    const [major = 0, minor = 0] = device.iosVersion.split('.').map(Number);
    if (major < 16 || (major === 16 && minor < 4)) {
      return 'unsupported';
    }
  }
  if (device.ios && !device.standalone) {
    return 'ios-home-screen';
  }
  if (!('serviceWorker' in navigator && 'PushManager' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return (await reg.pushManager.getSubscription()) ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

export function PushSubscribeButton({ slug, lang, vapidPublicKey, t }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceContext | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const detectedDevice = deviceContext();
    setDevice(detectedDevice);
    void detectStatus(detectedDevice).then((detected) => !cancelled && setStatus(detected));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!celebrate) {
      return;
    }
    const timer = window.setTimeout(() => setCelebrate(false), 3200);
    return () => window.clearTimeout(timer);
  }, [celebrate]);

  async function subscribe() {
    setBusy(true);
    setFeedback(null);
    setCelebrate(false);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const key = decodeVapidKey(vapidPublicKey);
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, lang, subscription: sub.toJSON(), deviceHints: clientDeviceHints() }),
      });
      if (!res.ok) {
        throw new Error('server');
      }
      setStatus('subscribed');
      setFeedback(t.subscribeOk);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setCelebrate(true);
      }
    } catch (err) {
      if (Notification.permission === 'denied') {
        setStatus('denied');
      } else if (err instanceof VapidKeyError) {
        setFeedback(err.message);
      } else {
        setFeedback(t.errorGeneric);
      }
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setFeedback(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('unsubscribed');
      setFeedback(t.unsubscribeOk);
    } catch {
      setFeedback(t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (status === 'checking' || status === 'unsupported' || status === 'denied' || status === 'ios-home-screen') {
    return (
      <>
        <StatusNotice status={status} device={device} t={t} />
        {celebrate ? <Confetti /> : null}
      </>
    );
  }

  const failed = feedback !== null && feedback !== t.subscribeOk && feedback !== t.unsubscribeOk;
  const success = failed ? null : feedback;
  const failure = failed ? feedback : null;

  return (
    <div className={styles.push}>
      {device?.android && !device.chrome && status === 'unsubscribed' ? (
        <StatusMessage tone="info">{t.androidUseChrome}</StatusMessage>
      ) : null}
      {status === 'subscribed' ? (
        <>
          <StatusMessage tone="success">{t.subscribed}</StatusMessage>
          <Button onClick={unsubscribe} loading={busy}>
            {t.unsubscribe}
          </Button>
        </>
      ) : (
        <Button variant="primary" icon="bell" onClick={subscribe} loading={busy}>
          {busy ? t.subscribing : t.subscribe}
        </Button>
      )}
      <StatusMessage tone="success">{success}</StatusMessage>
      <StatusMessage tone="danger">{failure}</StatusMessage>
      {celebrate ? <Confetti /> : null}
    </div>
  );
}

function Confetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {CONFETTI_PIECES.map((piece) => (
        <span
          key={piece.id}
          className={styles.confettiPiece}
          style={{ left: piece.left, animationDelay: piece.delay }}
        />
      ))}
    </div>
  );
}
