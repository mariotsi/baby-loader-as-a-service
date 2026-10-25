import type { Metadata } from 'next';
import './globals.css';
import { EnvironmentRibbon } from '@/components/EnvironmentRibbon';
import { LangProvider } from '@/components/LangProvider';
import { addressEnv } from '@/lib/env';
import { platformLang } from '@/lib/i18nNext';
import { googleFontsHref, PLATFORM_FONT, platformStyle, rootTokenCss } from '@/lib/theme';

const DESCRIPTION = 'Create a customizable countdown & announcement page for your baby, in minutes.';

/**
 * The Platform's name and how its links look when shared. The favicon,
 * icons and Open Graph images are files beside the routes (`favicon.ico`,
 * `icon.svg`, `apple-icon.png`, `opengraph-image.png`, and the Dashboard's
 * own under `dashboard/`), which Next.js turns into the tags; `metadataBase`
 * makes their URLs absolute, as link previews need. Saved to a home screen,
 * a page is named by `appleWebApp` on iOS and by `manifest.ts` on Android:
 * the name alone, without the tagline the title carries.
 */
export function generateMetadata(): Metadata {
  const { protocol, rootDomain } = addressEnv();
  return {
    metadataBase: new URL(`${protocol}://${rootDomain}`),
    title: { default: 'Loading Baby: for the days before the big day', template: '%s · Loading Baby' },
    description: DESCRIPTION,
    applicationName: 'Loading Baby',
    // A saved Platform page opens in Safari, as a bookmark; a Public page overrides this to open full screen.
    appleWebApp: { title: 'Loading Baby', capable: false },
    openGraph: { siteName: 'Loading Baby', type: 'website', description: DESCRIPTION },
    twitter: { card: 'summary_large_image' },
  };
}

/**
 * Every page starts in the Platform's language. A Public page then switches
 * `<html lang>` to the Language it shows, which may be another when its Site
 * does not speak the Platform's.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await platformLang();
  return (
    <html lang={lang}>
      <head>
        {/* The Platform's theme; a Public page overrides it with its Site's (see rootTokenCss). */}
        <style>{rootTokenCss(platformStyle())}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={googleFontsHref([PLATFORM_FONT])} />
      </head>
      <body>
        <LangProvider lang={lang}>{children}</LangProvider>
        <EnvironmentRibbon />
      </body>
    </html>
  );
}
