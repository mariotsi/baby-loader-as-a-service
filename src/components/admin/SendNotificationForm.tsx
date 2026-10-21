'use client';

import { type FormEvent, useState } from 'react';
import type { Lang } from '@/lib/i18n';
import { describeSiteSettingsErrors } from './siteSettingsErrorText';

/** Sends one text, in the Site's primary language `lang`; every Subscription receives it. */
export function SendNotificationForm({ slug, lang }: { slug: string; lang: Lang }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    const res = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, messages: { [lang]: title.trim() ? { title, body } : { body } } }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setResult(`Sent to ${data.sent} of ${data.total} subscribers.`);
      setBody('');
    } else {
      setResult(data.errors ? describeSiteSettingsErrors(data.errors) : data.error || 'Something went wrong.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card stack">
      <div className="field">
        <label htmlFor="notification-title">
          Title (optional, defaults to the baby&apos;s name unless Privacy settings hide it before the birth)
        </label>
        <input id="notification-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="notification-message">Message</label>
        <textarea id="notification-message" required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {result ? <p className="muted">{result}</p> : null}
      <button className="btn" type="submit" disabled={sending} style={{ alignSelf: 'flex-start' }}>
        {sending ? 'Sending…' : 'Send notification'}
      </button>
    </form>
  );
}
