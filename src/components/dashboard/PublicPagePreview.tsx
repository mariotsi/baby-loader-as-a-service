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
}

/**
 * The Public page itself, drawn from Site settings on an iPhone 16's screen in its
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
}: PublicPagePreviewProps) {
  const captionId = useId();
  return (
    <figure className={styles.figure}>
      <section
        className={styles.phone}
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
