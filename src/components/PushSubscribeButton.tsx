'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/i18n';
import type { PushButtonCopy } from '@/lib/publicPageView';
import { decodeVapidKey, VapidKeyError } from '@/lib/vapid';

interface Props {
  slug: string;
  /** The Public page's current language, stored with the Subscription. */
  lang: Lang;
  vapidPublicKey: string | undefined;
  t: PushButtonCopy;
}

type Status = 'checking' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

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
async function detectStatus(): Promise<Status> {
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

  useEffect(() => {
    let cancelled = false;
    void detectStatus().then((detected) => {
      if (!cancelled) {
        setStatus(detected);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      setFeedback(t.subscribeOk);
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

  if (status === 'checking') {
    return <p className="muted">{t.checking}</p>;
  }
  if (status === 'unsupported') {
    return <p className="muted">{t.errorUnsupported}</p>;
  }
  if (status === 'denied') {
    return <p className="muted">{t.errorDenied}</p>;
  }

  const buttonLabel = busy ? t.subscribing : t.subscribe;

  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      {status === 'subscribed' ? (
        <>
          <p className="muted">{t.subscribed}</p>
          <button type="button" className="btn btn-secondary" onClick={unsubscribe} disabled={busy}>
            {t.unsubscribe}
          </button>
        </>
      ) : (
        <button type="button" className="btn" onClick={subscribe} disabled={busy}>
          {buttonLabel}
        </button>
      )}
      {feedback ? <p className="muted">{feedback}</p> : null}
    </div>
  );
}
