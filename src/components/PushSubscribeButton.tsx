'use client';

import { useEffect, useState } from 'react';
import { decodeVapidKey, VapidKeyError } from '@/lib/vapid';
import type { Messages } from '@/lib/messages';

interface Props {
  tenantSlug: string;
  vapidPublicKey: string | undefined;
  born: boolean;
  t: Pick<
    Messages,
    | 'checking'
    | 'subscribedBorn'
    | 'subscribedWaiting'
    | 'unsubscribe'
    | 'subscribeBorn'
    | 'subscribeWaiting'
    | 'subscribing'
    | 'subscribeOk'
    | 'unsubscribeOk'
    | 'errorGeneric'
    | 'errorUnsupported'
    | 'errorDenied'
  >;
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

export function PushSubscribeButton({ tenantSlug, vapidPublicKey, born, t }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) {
          setStatus('unsupported');
        }
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) {
          setStatus('denied');
        }
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) {
          setStatus(sub ? 'subscribed' : 'unsubscribed');
        }
      } catch {
        if (!cancelled) {
          setStatus('unsubscribed');
        }
      }
    }
    check();
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
        body: JSON.stringify({ tenantSlug, subscription: sub.toJSON(), deviceHints: clientDeviceHints() }),
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
          body: JSON.stringify({ tenantSlug, endpoint: sub.endpoint }),
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

  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      {status === 'subscribed' ? (
        <>
          <p className="muted">{born ? t.subscribedBorn : t.subscribedWaiting}</p>
          <button className="btn btn-secondary" onClick={unsubscribe} disabled={busy}>
            {t.unsubscribe}
          </button>
        </>
      ) : (
        <button className="btn" onClick={subscribe} disabled={busy}>
          {busy ? t.subscribing : born ? t.subscribeBorn : t.subscribeWaiting}
        </button>
      )}
      {feedback && <p className="muted">{feedback}</p>}
    </div>
  );
}
