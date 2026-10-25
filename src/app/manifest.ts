import type { MetadataRoute } from 'next';

/**
 * What Android names and draws a page saved to its home screen: the name
 * alone, and the app icons from the brand kit. It opens in the browser, as a
 * bookmark, so the Platform does not become an installable app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Loading Baby',
    short_name: 'Loading Baby',
    start_url: '/',
    display: 'browser',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
