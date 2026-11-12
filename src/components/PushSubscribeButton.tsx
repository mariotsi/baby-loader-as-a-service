'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { StatusPill } from '@/components/ui/StatusPill';
import { type PublicPageCopy, publicPageCopy, type StepIcon, type StepText } from '@/lib/copy/publicPage';
import type { Lang } from '@/lib/i18n';
import {
  homeScreenSteps,
  type NotificationStatus,
  type SupportDevice,
  supportDevice,
  supportGuide,
  supportNotice,
  supportOf,
} from '@/lib/notificationSupport';
import type { PublicPageView } from '@/lib/publicPageView';
import { decodeVapidKey } from '@/lib/vapid';
import { Confetti, type ConfettiOrigin, confettiOrigin } from './Confetti';
import { isStandalone } from './isStandalone';
import styles from './PushSubscribeButton.module.css';

interface Props {
  slug: string;
  /** The Public page's current language, stored with the Subscription. */
  lang: Lang;
  vapidPublicKey: string | undefined;
  /** The words that depend on the Site, from its view; the rest come from the Public page's copy in `lang`. */
  push: PublicPageView['push'];
  /** Where the "notifications on" pill goes, away from the call to action. */
  pillSlot?: HTMLElement | null;
  subscribedContent?: ReactNode;
}

/** The button's words in one language. */
type PushCopy = PublicPageCopy & PublicPageView['push'];

type Feedback = 'subscribeOk' | 'unsubscribeOk' | 'errorGeneric' | 'errorUnsubscribe';

/** How long "You are all set" stays where the button was, before only the pill remains. */
const SUBSCRIBE_OK_MS = 6000;

type Status = NotificationStatus;

/** The words of a status that stops the device from subscribing, with the guide that helps there. */
function StatusNotice({
  status,
  device,
  t,
}: {
  status: Exclude<Status, 'subscribed' | 'unsubscribed'>;
  device: SupportDevice | null;
  t: PushCopy;
}) {
  const guide = supportGuide(status, device);
  return (
    <div className={styles.push}>
      <StatusMessage tone="info" fullWidth title={t.notificationsHelpTitle}>
        <div className={styles.instructions}>
          {status === 'ios-home-screen' ? (
            <IPhoneInstructions device={device} t={t} />
          ) : (
            t[supportNotice(status, device)]
          )}
          {guide ? (
            <span className={styles.instructionBody}>
              <ExternalLink href={guide.href}>{t[guide.label]}</ExternalLink>
            </span>
          ) : null}
          {status === 'ios-home-screen' ? (
            <span className={styles.instructionBody}>
              <ExternalLink href="https://webkit.org/blog/13878/">{t.iosHomeScreen}</ExternalLink>
            </span>
          ) : null}
        </div>
      </StatusMessage>
    </div>
  );
}

const STEP_ICONS: Record<StepIcon, IconName> = {
  share: 'share-ios',
  more: 'more-ios',
  pageMenu: 'page-menu',
  addToHome: 'home-add',
};

/** One step in words, with each control it names set apart and followed by the icon the iPhone shows beside it. */
function Instruction({ text }: { text: StepText }) {
  return text.map((part, i) =>
    typeof part === 'string' ? (
      part
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: a step's parts never change order.
      <span className={styles.instructionAction} key={i}>
        <em>{part.name}</em> {part.icon ? <Icon name={STEP_ICONS[part.icon]} /> : null}
      </span>
    )
  );
}

function IPhoneInstructions({ device, t }: { device: SupportDevice | null; t: PushCopy }) {
  const { numbered, steps } = homeScreenSteps(device);
  return (
    <>
      {numbered ? (
        <ol className={styles.steps}>
          {steps.map((entry) => (
            <li key={entry}>
              <Instruction text={t[entry]} />
            </li>
          ))}
        </ol>
      ) : (
        steps.map((entry) => (
          <span className={styles.instructionBody} key={entry}>
            <Instruction text={t[entry]} />
          </span>
        ))
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

/** Where this browser stands with Notifications, before the Visitor does anything. */
async function detectStatus(device: SupportDevice, slug: string): Promise<Status> {
  const pushApis = 'serviceWorker' in navigator && 'PushManager' in window;
  const support = supportOf(device, { pushApis, permission: pushApis ? Notification.permission : null });
  if (support !== 'supported') {
    return support;
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

export function PushSubscribeButton({ slug, lang, vapidPublicKey, push, pillSlot, subscribedContent }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [device, setDevice] = useState<SupportDevice | null>(null);
  const [confettiShot, setConfettiShot] = useState<{ origin: ConfettiOrigin } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const detectedDevice = supportDevice(navigator.userAgent, isStandalone());
    setDevice(detectedDevice);
    void detectStatus(detectedDevice, slug).then((detected) => !cancelled && setStatus(detected));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (feedback !== 'subscribeOk') {
      return;
    }
    const timer = window.setTimeout(() => setFeedback(null), SUBSCRIBE_OK_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function subscribe(origin: ConfettiOrigin) {
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
      setFeedback('subscribeOk');
      setConfettiShot({ origin });
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
        lang={lang}
        push={push}
        busy={busy}
        feedback={feedback}
        confirmOpen={confirmOpen}
        pillSlot={pillSlot}
        subscribedContent={subscribedContent}
        onSubscribe={subscribe}
        onUnsubscribe={unsubscribe}
        onConfirmOpenChange={setConfirmOpen}
      />
      <Confetti shot={confettiShot} />
    </>
  );
}

/** Renders notification controls from their resolved state, shared by the page and stories. */
export function PushSubscribeView({
  subscribedContent,
  status,
  device,
  lang,
  push,
  busy = false,
  feedback = null,
  confirmOpen = false,
  pillSlot,
  onSubscribe,
  onUnsubscribe,
  onConfirmOpenChange,
}: {
  status: Status;
  device: SupportDevice | null;
  lang: Lang;
  push: PublicPageView['push'];
  busy?: boolean;
  feedback?: Feedback | null;
  confirmOpen?: boolean;
  /** Renders the pill there instead of in place; left out, it stays in place, as in stories. */
  pillSlot?: HTMLElement | null;
  subscribedContent?: ReactNode;
  /** Called with the pressed button's centre, where the celebration starts. */
  onSubscribe: (origin: ConfettiOrigin) => void;
  onUnsubscribe: () => void;
  onConfirmOpenChange: (open: boolean) => void;
}) {
  const t: PushCopy = { ...publicPageCopy[lang], ...push };
  if (status === 'checking' || status === 'unsupported' || status === 'denied' || status === 'ios-home-screen') {
    return <StatusNotice status={status} device={device} t={t} />;
  }

  const success = feedback === 'subscribeOk' || feedback === 'unsubscribeOk' ? t[feedback] : null;
  const failure = feedback === 'errorGeneric' || feedback === 'errorUnsubscribe' ? t[feedback] : null;
  const pill = (
    <>
      {subscribedContent}
      <StatusPill
        className={styles.pill}
        action={
          <Button variant="link" size="sm" inline onClick={() => onConfirmOpenChange(true)} loading={busy}>
            {t.unsubscribeLink}
          </Button>
        }
      >
        {t.subscribed}
      </StatusPill>
    </>
  );
  const placedPill = pillSlot === undefined ? pill : pillSlot && createPortal(pill, pillSlot);

  return (
    <div className={styles.push}>
      {status === 'subscribed' ? (
        placedPill
      ) : (
        <Button
          variant="primary"
          icon="bell"
          fullWidth
          onClick={(event) => onSubscribe(confettiOrigin(event.currentTarget))}
          loading={busy}
        >
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
