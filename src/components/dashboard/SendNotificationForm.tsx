'use client';

import Link from 'next/link';
import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { PerLanguageField } from '@/components/ui/PerLanguageField';
import { Stack } from '@/components/ui/Stack';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Textarea } from '@/components/ui/Textarea';
import { platformCopy } from '@/lib/copy/platform';
import { responseErrorText } from '@/lib/errorText';
import { type Lang, languageName } from '@/lib/i18n';
import styles from './SendNotificationForm.module.css';

type Texts = Partial<Record<Lang, string>>;

interface SendNotificationFormProps {
  slug: string;
  /** The Site's Languages: one title and one message each. */
  languages: Lang[];
  /** The title a Notification has when none is written, or none while the Privacy settings hide the name. */
  defaultTitle?: string;
  /** What the notification shows beside the text, as delivery picks it (see notificationIcon). */
  icon: string;
  /** The Site's name in each Language, as a home screen shows it. */
  siteName: Partial<Record<Lang, string>>;
  /** The Site's Address without its scheme, where a notification comes from. */
  host: string;
  subscribers: number;
  subscriptionsHref: string;
  /** The birth notification in each Language, once the baby is born. */
  birth: Partial<Record<Lang, { title: string; body: string }>> | null;
}

/**
 * Sends one Notification with a title and a message in each of the Site's
 * Languages; every Subscription receives the text in its own (see
 * deliverNotification). A preview per Language shows it as it arrives.
 */
export function SendNotificationForm({
  slug,
  languages,
  defaultTitle,
  icon,
  siteName,
  host,
  subscribers,
  subscriptionsHref,
  birth,
}: SendNotificationFormProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang].send;
  const [titles, setTitles] = useState<Texts>({});
  const [bodies, setBodies] = useState<Texts>({});
  const [usedBirth, setUsedBirth] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [checked, setChecked] = useState(false);
  const [failedSends, setFailedSends] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (failedSends > 0) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [failedSends]);

  const missing = languages.filter((lang) => !bodies[lang]?.trim());
  // Nothing turns red before the first send; then each message clears once written.
  const bodyErrors: Texts = checked
    ? Object.fromEntries(missing.map((lang) => [lang, t.missingBody(languageName(lang, pageLang))]))
    : {};

  let failure: string | null = null;
  if (result && !result.ok) {
    failure = result.text;
  } else if (checked && missing.length > 0) {
    failure = t.checkMessages;
  }

  function applyBirthTexts() {
    if (!birth) {
      return;
    }
    setTitles(Object.fromEntries(languages.map((lang) => [lang, birth[lang]?.title ?? ''])));
    setBodies(Object.fromEntries(languages.map((lang) => [lang, birth[lang]?.body ?? ''])));
    setUsedBirth(true);
  }

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    setChecked(true);
    if (missing.length > 0) {
      setFailedSends((count) => count + 1);
      return;
    }
    setConfirming(true);
  }

  async function send() {
    setSending(true);
    const messages = Object.fromEntries(
      languages.map((lang) => {
        const title = titles[lang]?.trim();
        const body = bodies[lang]?.trim() ?? '';
        return [lang, title ? { title, body } : { body }];
      })
    );
    const res = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, messages }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setSending(false);
    setConfirming(false);
    if (res?.ok) {
      setResult({ ok: true, text: t.sent(data.sent, data.total) });
      setTitles({});
      setBodies({});
      setUsedBirth(false);
      setChecked(false);
    } else {
      setResult({ ok: false, text: responseErrorText(data, pageLang) });
    }
  }

  return (
    <div className={styles.layout}>
      <Card>
        <form ref={formRef} onSubmit={submit} noValidate>
          <Stack gap={5}>
            <p className={styles.audience}>
              <Link href={subscriptionsHref}>{t.audience(subscribers)}</Link>
            </p>
            {birth ? (
              <div>
                <Button variant="ghost" icon="sparkles" onClick={applyBirthTexts}>
                  {t.useBirth}
                </Button>
              </div>
            ) : null}
            <PerLanguageField
              label={t.titleField}
              hint={t.titleHint}
              languages={languages}
              value={titles}
              onChange={(lang, text) => setTitles({ ...titles, [lang]: text })}
              optional
            >
              {({ lang, value, onChange }) => (
                <Input lang={lang} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
              )}
            </PerLanguageField>
            <PerLanguageField
              label={t.message}
              languages={languages}
              value={bodies}
              onChange={(lang, text) => setBodies({ ...bodies, [lang]: text })}
              errors={bodyErrors}
            >
              {({ lang, value, onChange }) => (
                <Textarea
                  lang={lang}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={platformCopy[lang].send.messagePlaceholder}
                />
              )}
            </PerLanguageField>
            <Stack direction="row" gap={3}>
              <Button variant="primary" type="submit" icon="bell" loading={sending}>
                {sending ? t.sending : t.submit}
              </Button>
              <StatusMessage tone="info">{result?.ok ? result.text : null}</StatusMessage>
              <StatusMessage tone="danger">{failure}</StatusMessage>
            </Stack>
          </Stack>
        </form>
      </Card>

      <Card title={t.preview} description={languages.length > 1 ? t.previewNote : undefined}>
        <ul className={styles.previews}>
          {languages.map((lang) => (
            <li key={lang} className={styles.previewItem}>
              {languages.length > 1 ? (
                <span className={styles.previewLang}>{t.previewIn(languageName(lang, pageLang))}</span>
              ) : null}
              <div className={styles.notification} lang={lang}>
                <div className={styles.notificationText}>
                  <strong className={styles.notificationTitle}>
                    {titles[lang]?.trim() || defaultTitle || siteName[lang]}
                  </strong>
                  <span className={styles.notificationSource}>
                    {siteName[lang]} · {host}
                  </span>
                  <span className={styles.notificationBody}>
                    {bodies[lang]?.trim() || platformCopy[lang].send.messagePlaceholder}
                  </span>
                </div>
                {/* biome-ignore lint/performance/noImgElement: The icon is the one the notification itself loads. */}
                <img className={styles.notificationIcon} src={icon} alt="" width={48} height={48} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={confirming}
        title={t.confirmTitle(subscribers)}
        description={usedBirth ? t.confirmBirthAgain : t.confirmDescription}
        confirmLabel={t.submit}
        dismissLabel={t.keepEditing}
        busy={sending}
        onConfirm={() => void send()}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
