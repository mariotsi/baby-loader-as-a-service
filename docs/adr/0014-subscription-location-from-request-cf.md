# A Subscription's location comes from Cloudflare's `request.cf`

When a Visitor subscribes, the Platform stores where they subscribed from (city, region, country, coordinates, timezone and network), and the Subscriptions page shows the city and the country. It reads them from the `cf` properties Cloudflare sets on every request to the Worker, through `requestGeo()` in `src/lib/geoipNext.ts`. `geoFromCf()` in `src/lib/geoip.ts` turns them into the stored `GeoLocation`.

The Visitor's IP stays inside Cloudflare, which already terminates the request: no other service learns it. Reading `cf` costs nothing and needs no key, and it cannot be refused. A lookup service's free tier counts its limit per calling address, and a Worker's calls go out from addresses Cloudflare shares across its customers, so such a limit is spent before the Platform asks. That is how ipapi.co answered 429 to every lookup once the Platform moved to Workers.

## Consequences

- The stored location has no currency, calling code, languages, capital or top-level domain, which a lookup service adds. Nothing on the Platform reads them. Subscriptions stored before this still hold them, and `GeoLocation` does not type them.
- `country` is the English name of Cloudflare's two-letter code, as the lookup service stored it. A code that names no country, such as `T1` for Tor, keeps its code and has no name.
- Under `next dev` there is no `cf`, so a Subscription made there has no location. The local Worker that `npm run e2e` runs has the properties Miniflare gives it.
