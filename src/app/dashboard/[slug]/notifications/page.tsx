import { FinishSendingButton } from '@/components/dashboard/FinishSendingButton';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/ui/PageShell';
import { platformCopy } from '@/lib/copy/platform';
import { fallbackLang, type Lang } from '@/lib/i18n';
import { platformLang } from '@/lib/i18nNext';
import { deliverySummary } from '@/lib/notificationDelivery';
import { listNotifications, type NotificationMessages } from '@/lib/notificationLog';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import styles from '../../dashboard.module.css';

/** The words a Notification is known by: its title, else its message, in the page's language when it was written in it. */
function heading(messages: NotificationMessages, lang: Lang, languages: readonly Lang[]): string {
  const text = messages[lang] ?? messages[fallbackLang(languages)] ?? Object.values(messages)[0];
  return text?.title || text?.body || '';
}

export default async function NotificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);
  const name = site.babyName || site.slug;
  const lang = await platformLang();
  const { dashboard, notifications: t, send, subscriptions } = platformCopy[lang];
  const when = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });

  const notifications = await listNotifications(site.id);

  return (
    <PageShell
      width="wide"
      nav={
        <ButtonLink href={`/dashboard/${site.slug}`} variant="ghost" size="sm" icon="arrow-left">
          {dashboard.backTo(name)}
        </ButtonLink>
      }
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lead}>{t.lead(name)}</p>
        </div>
        <ButtonLink href={`/dashboard/${site.slug}/send`} icon="bell">
          {dashboard.sendNotification}
        </ButtonLink>
      </div>
      {notifications.length > 0 ? (
        <ul className={styles.list}>
          {notifications.map((notification) => {
            const { sent, total, finishable } = deliverySummary(notification, site);
            return (
              <li key={notification.id}>
                <Card>
                  <div className={styles.item}>
                    <p className={styles.itemTitle}>{heading(notification.messages, lang, site.languages)}</p>
                    {notification.kind === 'birth' ? (
                      <div>
                        <Badge size="sm">{t.birth}</Badge>
                      </div>
                    ) : null}
                    <p className={styles.itemMeta}>{t.sentOn(when.format(new Date(notification.createdAt)))}</p>
                    <p className={styles.itemMeta}>{send.sent(sent, total)}</p>
                    {notification.deliveries.length > 0 ? (
                      <details className={styles.deliveries}>
                        <summary>{t.devices}</summary>
                        <ul>
                          {notification.deliveries.map((delivery, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: a Delivery keeps its place and has no id here.
                            <li key={i}>
                              <span>{delivery.deviceLabel ?? subscriptions.unknownDevice}</span>
                              <Badge size="sm" variant="plain">
                                {t.status[delivery.status]}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {finishable ? <FinishSendingButton slug={site.slug} notificationId={notification.id} /> : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <p className={styles.itemMeta}>{t.nobody}</p>
        </Card>
      )}
    </PageShell>
  );
}
