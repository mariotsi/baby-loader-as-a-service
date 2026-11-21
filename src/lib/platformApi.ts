import ky, { isHTTPError } from 'ky';

/**
 * The Platform's own routes as the browser calls them, through
 * [ky](https://github.com/sindresorhus/ky): `platformApi.post('sites', { json })`
 * reaches `/api/sites`. A route that refuses answers a non-2xx status, which
 * ky throws as an `HTTPError` holding the route's body; `refusalOf` reads it
 * back for `responseErrorText`.
 *
 * Two of ky's defaults are off here, because both would change what a save
 * does:
 * - `retry: 0`. A Site settings or Birth save is a PUT that sends the
 *   `updatedAt` it read, so a retry after a dropped answer reaches a Site the
 *   first attempt already changed, and the route answers 409 as if another
 *   tab had saved.
 * - `timeout: false`. Sending a Notification answers once every Subscription
 *   was tried, and a Birth video uploads in the same request, so either can
 *   take longer than any fixed limit.
 */
export const platformApi = ky.create({
  prefix: '/api/',
  // Resolves `/api/…` against the page. ky hands fetch a Request, which needs an absolute URL outside a browser.
  baseUrl: globalThis.location?.origin,
  retry: 0,
  timeout: false,
});

/**
 * What a route answered when it refused: its body, such as `{ error }` or
 * `{ errors }`, or null when no answer came or it was not JSON. A failed call
 * through `platformApi` throws; this reads any of its errors.
 */
export function refusalOf(error: unknown): unknown {
  return isHTTPError(error) && typeof error.data === 'object' ? error.data : null;
}

/** The status a route refused with, or null when no answer came. */
export function refusedStatus(error: unknown): number | null {
  return isHTTPError(error) ? error.response.status : null;
}
