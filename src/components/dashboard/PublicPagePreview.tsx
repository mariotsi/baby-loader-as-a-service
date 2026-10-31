import { type CSSProperties, useId } from 'react';
import { PublicPage } from '@/components/PublicPage';
import type { Lang } from '@/lib/i18n';
import { publicPageViews } from '@/lib/publicPageView';
import type { SiteSettings } from '@/lib/siteSettings';
import { themeStyle } from '@/lib/theme';
import styles from './PublicPagePreview.module.css';

interface PublicPagePreviewProps {
  /** The Site settings to draw, saved or not. */
  settings: SiteSettings;
  slug: string;
  /** The Language the page opens in. */
  lang: Lang;
  caption: string;
  bornImageUrl?: string;
  birthVideoUrl?: string;
  /** Below 48rem the frame fills its parent's height, for a preview that takes the whole screen. */
  compact?: boolean;
}

/**
 * The Public page itself, drawn from Site settings on an iPhone 16 Pro's screen in its
 * own Theme, as a Visitor on a phone would see it. It scrolls inside its
 * frame, and only its Language switcher can be pressed.
 */
export function PublicPagePreview({
  settings,
  slug,
  lang,
  caption,
  bornImageUrl,
  birthVideoUrl,
  compact = false,
}: PublicPagePreviewProps) {
  const captionId = useId();
  return (
    <figure className={compact ? `${styles.figure} ${styles.compactFigure}` : styles.figure}>
      <section
        className={compact ? `${styles.phone} ${styles.compact}` : styles.phone}
        style={themeStyle(settings.theme) as CSSProperties}
        aria-labelledby={captionId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The frame scrolls and little in it takes the focus, so the frame does, for the keyboard to scroll it.
        tabIndex={0}
      >
        <PublicPage
          views={publicPageViews(settings)}
          initialLang={lang}
          slug={slug}
          vapidPublicKey={undefined}
          bornImageUrl={bornImageUrl}
          birthVideoUrl={birthVideoUrl}
          preview
        />
      </section>
      <figcaption id={captionId} className={styles.caption}>
        {caption}
      </figcaption>
    </figure>
  );
}
