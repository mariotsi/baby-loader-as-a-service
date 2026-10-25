'use client';

import { type SubmitEvent, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Stack } from '@/components/ui/Stack';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Textarea } from '@/components/ui/Textarea';
import { responseErrorText } from '@/lib/errorText';
import type { Lang } from '@/lib/i18n';

/** Sends one text, in `lang`, the Site's fallback Language (see fallbackLang); every Subscription receives it. */
export function SendNotificationForm({ slug, lang }: { slug: string; lang: Lang }) {
  const pageLang = useLang();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
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
      setResult({ ok: true, text: `Sent to ${data.sent} of ${data.total} subscribers.` });
      setBody('');
    } else {
      setResult({ ok: false, text: responseErrorText(data, pageLang) });
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <Stack gap={5}>
          <Field
            label="Title"
            optional
            hint="Left empty, it is the baby's name, unless your Privacy settings hide it before the birth."
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Message" required>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Any day now!" />
          </Field>
          <Stack direction="row" gap={3}>
            <Button variant="primary" type="submit" icon="bell" loading={sending}>
              {sending ? 'Sending…' : 'Send notification'}
            </Button>
            <StatusMessage tone="info">{result?.ok ? result.text : null}</StatusMessage>
            <StatusMessage tone="danger">{result && !result.ok ? result.text : null}</StatusMessage>
          </Stack>
        </Stack>
      </form>
    </Card>
  );
}
