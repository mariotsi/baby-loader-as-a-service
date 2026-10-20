'use client';

import { useState, type FormEvent } from 'react';

export function SendNotificationForm({ tenantSlug }: { tenantSlug: string }) {
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
      body: JSON.stringify({ tenantSlug, title, body }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setResult(`Sent to ${data.sent} of ${data.total} subscribers.`);
      setBody('');
    } else {
      setResult(data.error || 'Something went wrong.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card stack">
      <div className="field">
        <label>Title (optional, defaults to the baby&apos;s name unless Privacy settings hide it before the birth)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>Message</label>
        <textarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {result && <p className="muted">{result}</p>}
      <button className="btn" type="submit" disabled={sending} style={{ alignSelf: 'flex-start' }}>
        {sending ? 'Sending…' : 'Send notification'}
      </button>
    </form>
  );
}
