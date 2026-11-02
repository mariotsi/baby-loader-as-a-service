import type { Metadata } from 'next';
import './globals.css';
import { EnvironmentRibbon } from '@/components/EnvironmentRibbon';
import { HydrationMarker } from '@/components/HydrationMarker';
import { LangProvider } from '@/components/LangProvider';
import { platformCopy } from '@/lib/copy/platform';
import { addressEnv } from '@/lib/env';
import { platformLang } from '@/lib/i18nNext';
import { platformShareMeta } from '@/lib/platformShare';
import { googleFontsHref, PLATFORM_FONT, platformStyle, rootTokenCss } from '@/lib/theme';

/**
 * The Platform's name and how its links look when shared, in the language of
 * whoever asks (see platformShare.ts; the Dashboard has its own image). The
 * icons are files beside the routes (`icon.svg`, `apple-icon.png`), which
 * Next.js turns into the tags. `favicon.ico` sits in `public/`, which browsers
 * ask for on their own: in `app/`, Next.js would link it from every page,
 * a Public page with its Site's emoji icon included. `metadataBase`
 * makes their URLs absolute, as link previews need. Saved to a home screen,
 * a page is named by `appleWebApp` on iOS and by `manifest.ts` on Android:
 * the name alone, without the tagline the title carries.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { protocol, rootDomain } = addressEnv();
  const lang = await platformLang();
  const t = platformCopy[lang].meta;
  return {
    metadataBase: new URL(`${protocol}://${rootDomain}`),
    title: { default: t.title, template: '%s · Loading Baby' },
    description: t.description,
    applicationName: 'Loading Baby',
    // A saved Platform page opens in Safari, as a bookmark; a Public page overrides this to open full screen.
    appleWebApp: { title: 'Loading Baby', capable: false },
    ...platformShareMeta('marketing', lang),
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
        <HydrationMarker />
      </body>
    </html>
  );
}
