import type { Metadata } from 'next';
import './globals.css';
import { EnvironmentRibbon } from '@/components/EnvironmentRibbon';
import { googleFontsHref, PLATFORM_FONT, platformStyle, rootTokenCss } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Waiting Pages',
  description: 'Create a customizable countdown & announcement page for your baby, in minutes.',
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
