import type { Metadata } from 'next';
import './globals.css';
import { EnvironmentRibbon } from '@/components/EnvironmentRibbon';
import { ADDRESS_CONFIG } from '@/lib/address';
import { googleFontsHref, PLATFORM_FONT, platformStyle, rootTokenCss } from '@/lib/theme';

const DESCRIPTION = 'Create a customizable countdown & announcement page for your baby, in minutes.';

/**
 * The Platform's name and how its links look when shared. The favicon,
 * icons and Open Graph images are files beside the routes (`favicon.ico`,
 * `icon.svg`, `apple-icon.png`, `opengraph-image.png`, and the Dashboard's
 * own under `admin/`), which Next.js turns into the tags; `metadataBase`
 * makes their URLs absolute, as link previews need. Saved to a home screen,
 * a page is named by `appleWebApp` on iOS and by `manifest.ts` on Android:
 * the name alone, without the tagline the title carries.
 */
export const metadata: Metadata = {
  metadataBase: new URL(`${ADDRESS_CONFIG.protocol}://${ADDRESS_CONFIG.rootDomain}`),
  title: { default: 'Loading Baby: for the days before the big day', template: '%s · Loading Baby' },
  description: DESCRIPTION,
  applicationName: 'Loading Baby',
  // A saved Platform page opens in Safari, as a bookmark; a Public page overrides this to open full screen.
  appleWebApp: { title: 'Loading Baby', capable: false },
  openGraph: { siteName: 'Loading Baby', type: 'website', description: DESCRIPTION },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* The Platform's theme; a Public page overrides it with its Site's (see rootTokenCss). */}
        <style>{rootTokenCss(platformStyle())}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={googleFontsHref([PLATFORM_FONT])} />
      </head>
      <body>
        {children}
        <EnvironmentRibbon />
      </body>
    </html>
  );
}
