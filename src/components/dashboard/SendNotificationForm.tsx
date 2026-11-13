'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { type NotificationSite, notificationContent } from '@/lib/notificationContent';
import { messagesOf, type SendNotificationValues, sendNotificationFormSchema } from '@/lib/sendNotificationForm';
import { siteShortName } from '@/lib/siteAppIdentity';
import { NotificationPreviews } from './NotificationPreviews';
import styles from './SendNotificationForm.module.css';

/** An empty text in each Language: what the form starts from, and goes back to once a Notification is sent. */
function emptyValues(languages: readonly Lang[]): SendNotificationValues {
  const texts = Object.fromEntries(languages.map((lang) => [lang, '']));
  return { titles: { ...texts }, bodies: { ...texts } };
}

interface SendNotificationFormProps {
  slug: string;
  /** The Site's settings: its Languages (one title and one message each) and what a Notification's content draws on. */
  site: NotificationSite;
  /** What the notification shows beside the text, as delivery picks it (see notificationIcon). */
  icon: string;
  /** The Site's Address without its scheme, where a notification comes from. */
  host: string;
  subscribers: number;
  subscriptionsHref: string;
  /** Whether the birth is announced: until then sending asks first, pointing to announcing it instead. */
  born: boolean;
}

/**
 * Sends one Notification with a title and a message in each of the Site's
 * Languages; every Subscription receives the text in its own (see
 * deliverNotification). A preview per Language shows it as it arrives.
 */
export function SendNotificationForm({
  slug,
  site,
  icon,
  host,
  subscribers,
  subscriptionsHref,
  born,
}: SendNotificationFormProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang].send;
  const { languages } = site;
  const resolver = useMemo(() => zodResolver(sendNotificationFormSchema(languages)), [languages]);
  const { register, handleSubmit, reset, setError, control, formState } = useForm<SendNotificationValues>({
    defaultValues: emptyValues(languages),
    resolver,
  });
  const { titles, bodies } = useWatch({ control });
  const [confirming, setConfirming] = useState(false);
  // A send that reached every subscriber shows as a success, any other as plain information.
  const [sent, setSent] = useState<{ text: string; everyone: boolean } | null>(null);

  const bodyErrors: Partial<Record<Lang, string>> = Object.fromEntries(
    languages
      .filter((lang) => formState.errors.bodies?.[lang])
      .map((lang) => [lang, t.missingBody(languageName(lang, pageLang))])
  );
  const failure = formState.errors.root?.server?.message ?? (formState.errors.bodies ? t.checkMessages : null);

  async function send(values: SendNotificationValues) {
    const res = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, messages: messagesOf(values, languages) }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setConfirming(false);
    if (res?.ok) {
      setSent({ text: t.sent(data.sent, data.total), everyone: data.sent === data.total });
      reset(emptyValues(languages));
    } else {
      setError('root.server', { message: responseErrorText(data, pageLang) });
    }
  }

  /** Sends what the form holds, once it passes its checks. */
  const sendChecked = handleSubmit(send);
  /** Until the birth is announced a send asks first, pointing to announcing it instead. */
  const submit = handleSubmit((values) => (born ? send(values) : setConfirming(true)));

  return (
    <div className={styles.layout}>
      <Card>
        <form
          onSubmit={(e) => {
            setSent(null);
            void submit(e);
          }}
          noValidate
        >
          <Stack gap={5}>
            <PerLanguageField label={t.titleField} hint={t.titleHint} languages={languages} optional>
              {({ lang }) => <Input lang={lang} autoComplete="off" {...register(`titles.${lang}`)} />}
            </PerLanguageField>
            <PerLanguageField label={t.message} languages={languages} errors={bodyErrors}>
              {({ lang }) => (
                <Textarea
                  lang={lang}
                  placeholder={platformCopy[lang].send.messagePlaceholder}
                  {...register(`bodies.${lang}`)}
                />
              )}
            </PerLanguageField>
            <Stack direction="row" gap={3}>
              <Button variant="primary" type="submit" icon="bell" loading={formState.isSubmitting}>
                {formState.isSubmitting ? t.sending : t.submit}
              </Button>
              <StatusMessage tone="success">{sent?.everyone ? sent.text : null}</StatusMessage>
              <StatusMessage tone="info">{sent && !sent.everyone ? sent.text : null}</StatusMessage>
              <StatusMessage tone="danger">{failure}</StatusMessage>
            </Stack>
            <p className={styles.audience}>
              <Link href={subscriptionsHref}>{t.audience(subscribers)}</Link>
            </p>
          </Stack>
        </form>
      </Card>

      <Card title={t.preview} description={languages.length > 1 ? t.previewNote : undefined}>
        <NotificationPreviews
          languages={languages}
          texts={Object.fromEntries(
            languages.map((lang) => [
              lang,
              notificationContent(
                site,
                {
                  [lang]: {
                    title: titles?.[lang]?.trim(),
                    body: bodies?.[lang]?.trim() || platformCopy[lang].send.messagePlaceholder,
                  },
                },
                lang,
                icon
              ),
            ])
          )}
          siteName={Object.fromEntries(languages.map((lang) => [lang, siteShortName(site, lang)]))}
          host={host}
          icon={icon}
        />
      </Card>

      <ConfirmDialog
        open={confirming}
        title={t.confirmTitle(subscribers)}
        description={t.confirmNotBirth}
        confirmLabel={t.submit}
        dismissLabel={t.keepEditing}
        busy={formState.isSubmitting}
        onConfirm={() => void sendChecked()}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
