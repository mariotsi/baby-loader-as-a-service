'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { buildDeviceInfo } from '@/lib/deviceInfo';
import type { Lang } from '@/lib/i18n';
import type { PushButtonCopy } from '@/lib/publicPageView';
import { decodeVapidKey } from '@/lib/vapid';
import { Confetti, type ConfettiHandle } from './Confetti';
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
    return t.androidUnsupported;
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
      <StatusMessage tone="info" fullWidth>
        <div className={styles.instructions}>
          {status === 'ios-home-screen' ? (
            <IPhoneInstructions device={device} t={t} />
          ) : (
            statusNotice(status, device, t)
          )}
          {link ? <ExternalLink href={link.href}>{link.label}</ExternalLink> : null}
        </div>
      </StatusMessage>
    </div>
  );
}

const INSTRUCTION_ICONS: Record<string, IconName> = {
  Share: 'share-ios',
  Condividi: 'share-ios',
  More: 'more-ios',
  Altro: 'more-ios',
  'Page Menu': 'page-menu',
  'Menu pagina': 'page-menu',
  'Add to Home Screen': 'home-add',
  'Aggiungi alla schermata Home': 'home-add',
};

function Instruction({ text }: { text: string }) {
  let offset = 0;
  return (
    <>
      {text
        .split(
          /(Add to Home Screen|Aggiungi alla schermata Home|Open as Web App|Apri come app web|Page Menu|Menu pagina|Share|Condividi|More|Altro|Add|Aggiungi|Safari)/g
        )
        .map((part) => {
          const position = offset;
          offset += part.length;
          const icon = INSTRUCTION_ICONS[part];
          return icon || ['Open as Web App', 'Apri come app web', 'Add', 'Aggiungi', 'Safari'].includes(part) ? (
            <span className={styles.instructionAction} key={`${position}-${part}`}>
              <em>{part}</em> {icon ? <Icon name={icon} /> : null}
            </span>
          ) : (
            part
          );
        })}
    </>
  );
}

function IPhoneInstructions({ device, t }: { device: DeviceContext | null; t: PushButtonCopy }) {
  const major = Number(device?.iosVersion?.split('.')[0]);
  const known = (major >= 16 && major <= 18) || major === 26 || major === 27;
  let share = t.iosShare;
  if (major === 26) {
    share = t.iosMenu26;
  } else if (major === 27) {
    share = t.iosMenu27;
  }
  return (
    <>
      <ExternalLink href="https://webkit.org/blog/13878/">{t.iosHomeScreen}</ExternalLink>
      {known ? (
        <ol className={styles.steps}>
          <li>
            <Instruction text={t.iosOpenSafari} />
          </li>
          <li>
            <Instruction text={share} />
          </li>
          <li>
            <Instruction text={t.iosAddHome} />
          </li>
          {major >= 26 ? (
            <li>
              <Instruction text={t.iosEnableApp} />
            </li>
          ) : null}
          <li>
            <Instruction text={t.iosAdd} />
          </li>
          <li>{t.iosOpenApp}</li>
        </ol>
      ) : (
        <>
          <span className={styles.instructionBody}>
            <Instruction text={t.iosStepsGeneric} />
          </span>
          <span className={styles.instructionBody}>{t.iosOpenApp}</span>
        </>
      )}
      <span className={styles.appPreview}>
        {/* biome-ignore lint/performance/noImgElement: the preview uses the Site's fixed icon or Twemoji. */}
        <img
          src={t.appIcon}
          alt=""
          width={60}
          height={60}
          onError={(event) => {
            const image = event.currentTarget;
            if (!image.src.endsWith('/icon-192.png')) {
              image.src = '/icon-192.png';
            }
          }}
        />
        <span>{t.appName}</span>
      </span>
    </>
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
async function detectStatus(device: DeviceContext, slug: string): Promise<Status> {
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
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      return 'unsubscribed';
    }
    const query = new URLSearchParams({ slug, endpoint: sub.endpoint });
    const response = await fetch(`/api/subscribe?${query}`, { cache: 'no-store' });
    if (!response.ok) {
      return 'unsubscribed';
    }
    return (await response.json()).subscribed ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

export function PushSubscribeButton({ slug, lang, vapidPublicKey, t }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'unsubscribeOk' | 'errorGeneric' | 'errorUnsubscribe' | null>(null);
  const [device, setDevice] = useState<DeviceContext | null>(null);
  const confettiRef = useRef<ConfettiHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    const detectedDevice = deviceContext();
    setDevice(detectedDevice);
    void detectStatus(detectedDevice, slug).then((detected) => !cancelled && setStatus(detected));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function subscribe() {
    setBusy(true);
    setFeedback(null);
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
      setFeedback(null);
      confettiRef.current?.launch();
    } catch {
      if (Notification.permission === 'denied') {
        setStatus('denied');
      } else {
        setStatus('unsubscribed');
        setFeedback('errorGeneric');
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
        const response = await fetch('/api/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, endpoint: sub.endpoint }),
        });
        if (!response.ok) {
          throw new Error('server');
        }
      }
      setStatus('unsubscribed');
      setFeedback('unsubscribeOk');
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
      setFeedback('errorUnsubscribe');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PushSubscribeView
        status={status}
        device={device}
        t={t}
        busy={busy}
        feedback={feedback}
        confirmOpen={confirmOpen}
        onSubscribe={subscribe}
        onUnsubscribe={unsubscribe}
        onConfirmOpenChange={setConfirmOpen}
      />
      <Confetti ref={confettiRef} />
    </>
  );
}

/** Renders notification controls from their resolved state, shared by the page and stories. */
export function PushSubscribeView({
  status,
  device,
  t,
  busy = false,
  feedback = null,
  confirmOpen = false,
  onSubscribe,
  onUnsubscribe,
  onConfirmOpenChange,
}: {
  status: Status;
  device: DeviceContext | null;
  t: PushButtonCopy;
  busy?: boolean;
  feedback?: 'unsubscribeOk' | 'errorGeneric' | 'errorUnsubscribe' | null;
  confirmOpen?: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  onConfirmOpenChange: (open: boolean) => void;
}) {
  if (status === 'checking' || status === 'unsupported' || status === 'denied' || status === 'ios-home-screen') {
    return <StatusNotice status={status} device={device} t={t} />;
  }

  const success = feedback === 'unsubscribeOk' ? t.unsubscribeOk : null;
  const failure = feedback !== null && feedback !== 'unsubscribeOk' ? t[feedback] : null;

  return (
    <div className={styles.push}>
      {status === 'subscribed' ? (
        <StatusMessage tone="success" fullWidth>
          <span className={styles.subscribedContent}>
            <span>{t.subscribed}</span>
            <Button variant="link" size="sm" inline onClick={() => onConfirmOpenChange(true)} loading={busy}>
              {t.unsubscribeLink}
            </Button>
          </span>
        </StatusMessage>
      ) : (
        <Button variant="primary" icon="bell" fullWidth onClick={onSubscribe} loading={busy}>
          {busy ? t.subscribing : t.subscribe}
        </Button>
      )}
      <StatusMessage tone="success" fullWidth>
        {success}
      </StatusMessage>
      <StatusMessage tone="danger" fullWidth>
        {failure}
      </StatusMessage>
      <ConfirmDialog
        open={confirmOpen}
        title={t.unsubscribeTitle}
        description={t.unsubscribeDescription}
        confirmLabel={t.unsubscribe}
        dismissLabel={t.keepNotifications}
        busy={busy}
        onConfirm={onUnsubscribe}
        onClose={() => onConfirmOpenChange(false)}
      />
    </div>
  );
}
