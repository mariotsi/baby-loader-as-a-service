import { useLang } from '@/components/LangProvider';
import { platformCopy } from '@/lib/copy/platform';
import { type Lang, languageName } from '@/lib/i18n';
import styles from './NotificationPreviews.module.css';

interface NotificationPreviewsProps {
  /** One preview per Language, named when there are several. */
  languages: Lang[];
  /** What each Language's notification says: its title and its message. */
  texts: Partial<Record<Lang, { title: string; body: string }>>;
  /** The Site's name in each Language, as a home screen shows it. */
  siteName: Partial<Record<Lang, string>>;
  /** The Site's Address without its scheme, where a notification comes from. */
  host: string;
  /** What the notification shows beside the text, as delivery picks it (see notificationIcon). */
  icon: string;
}

/**
 * A Notification as it arrives, once for each of the Site's Languages: drawn
 * as macOS and Chrome draw one, with the text and the picture on the right.
 */
export function NotificationPreviews({ languages, texts, siteName, host, icon }: NotificationPreviewsProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang].send;
  return (
    <ul className={styles.previews}>
      {languages.map((lang) => (
        <li key={lang} className={styles.previewItem}>
          {languages.length > 1 ? (
            <span className={styles.previewLang}>{t.previewIn(languageName(lang, pageLang))}</span>
          ) : null}
          <div className={styles.notification} lang={lang}>
            <div className={styles.notificationText}>
              <strong className={styles.notificationTitle}>{texts[lang]?.title}</strong>
              <span className={styles.notificationSource}>
                {siteName[lang]} · {host}
              </span>
              <span className={styles.notificationBody}>{texts[lang]?.body}</span>
            </div>
            {/* biome-ignore lint/performance/noImgElement: The icon is the one the notification itself loads. */}
            <img className={styles.notificationIcon} src={icon} alt="" width={48} height={48} />
          </div>
        </li>
      ))}
    </ul>
  );
}
