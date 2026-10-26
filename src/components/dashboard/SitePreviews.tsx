import type { CSSProperties } from 'react';
import { useLang } from '@/components/LangProvider';
import { ShareCard } from '@/components/ShareCard';
import { Icon } from '@/components/ui/Icon';
import { platformCopy } from '@/lib/copy/platform';
import { fallbackLang } from '@/lib/i18n';
import { publicPageView } from '@/lib/publicPageView';
import { shareText, siteShortName, twemojiUrl } from '@/lib/siteMeta';
import type { SiteSettings } from '@/lib/siteSettings';
import { themeStyle } from '@/lib/theme';
import styles from './SitePreviews.module.css';

/**
 * How a Site looks outside its Public page, drawn from the editor's Site
 * settings as the Owner changes them: a browser tab with the favicon, an
 * iPhone home screen with the Site icon and its name, and a WhatsApp message
 * with the link preview. Each takes its words and pictures from siteMeta.ts and
 * ShareCard, as the generated images and the page's metadata do.
 */
export function SitePreviews({ settings, address }: { settings: SiteSettings; address: string }) {
  const dashboardLang = useLang();
  const t = platformCopy[dashboardLang].settings;
  // The Owner most likely shares from a phone set to the Dashboard's language, so the previews speak it when the Site does.
  const lang = settings.languages.includes(dashboardLang) ? dashboardLang : fallbackLang(settings.languages);
  const { title, description } = shareText(settings, lang);
  const view = publicPageView(settings, lang);
  const theme = themeStyle(settings.theme) as CSSProperties;

  return (
    <div className={styles.previews}>
      <figure className={styles.figure}>
        <div className={styles.browser}>
          <div className={styles.tabStrip}>
            <div className={styles.tab}>
              <span style={theme} className={styles.faviconFrame}>
                <SiteIcon icon={settings.icon} className={styles.favicon} />
              </span>
              <span className={styles.tabTitle}>{title}</span>
              <Icon name="x" className={styles.tabClose} />
            </div>
            <Icon name="plus" className={styles.newTab} />
          </div>
          <div className={styles.toolbar} aria-hidden="true">
            <Icon name="arrow-right" className={styles.back} />
            <Icon name="arrow-right" className={styles.forward} />
            <span className={styles.omnibox}>{address.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>
        <figcaption className={styles.caption}>{t.previewTab}</figcaption>
      </figure>

      <figure className={styles.figure}>
        <div className={styles.homeScreen}>
          <div className={styles.app}>
            <span style={theme} className={styles.appIconFrame}>
              <SiteIcon icon={settings.icon} className={styles.appIcon} />
            </span>
            <span className={styles.appName}>{siteShortName(settings, lang)}</span>
          </div>
          <span className={styles.otherApp} aria-hidden="true" />
          <span className={styles.otherApp} aria-hidden="true" />
          <span className={styles.otherApp} aria-hidden="true" />
        </div>
        <figcaption className={styles.caption}>{t.previewHomeScreen}</figcaption>
      </figure>

      <figure className={styles.figure}>
        <div className={styles.chat}>
          <div className={styles.bubble}>
            <div className={styles.linkPreview}>
              <div className={styles.shareImage} style={theme} aria-hidden="true">
                <ShareCard
                  view={view}
                  icon={<SiteIcon icon={settings.icon} className={styles.shareIcon} />}
                  px={(pixels) => `calc(${pixels} * 100cqw / 1200)`}
                  color={(token) => `var(${token})`}
                  font={{
                    display: 'var(--font-display)',
                    displayWeight: 'var(--font-display-weight)',
                    body: 'var(--font-body)',
                  }}
                />
              </div>
              <div className={styles.linkText}>
                <span className={styles.linkTitle}>{title}</span>
                <span className={styles.linkDescription}>{description}</span>
                <span className={styles.linkHost}>{address.replace(/^https?:\/\//, '')}</span>
              </div>
            </div>
            <span className={styles.url}>{address}</span>
          </div>
        </div>
        <figcaption className={styles.caption}>{t.previewChat}</figcaption>
      </figure>
      <p className={styles.note}>{t.previewChatNote}</p>
    </div>
  );
}

/** The Site icon as the generated images draw it: its emoji in Twemoji, or the loading baby. */
function SiteIcon({ icon, className }: { icon: string | null; className: string }) {
  return (
    // biome-ignore lint/performance/noImgElement: a remote Twemoji or a fixed icon, shown small; next/image adds nothing.
    <img
      className={className}
      src={icon ? twemojiUrl(icon) : '/apple-icon.png'}
      alt=""
      data-emoji={icon ? true : undefined}
    />
  );
}
