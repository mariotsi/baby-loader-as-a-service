# Every HTTP request goes through ky

The browser's calls to the Platform's own routes, and the Platform's calls to other services (Photon, ipapi, the Cloudflare API, Google Fonts), go through [ky](https://github.com/sindresorhus/ky). The browser's go through one instance, `platformApi` in `src/lib/platformApi.ts`, which reaches `/api/…`: `platformApi.post('sites', { json })`. A call to another service uses `ky` itself, with the options that service needs.

Each request site repeats the same steps on `fetch`: set the JSON header, stringify the body, check `ok`, read the JSON without trusting it to be JSON, and tell no answer from a refusal. Written by hand they drift: some forms read a refusal's body and some don't, some guard the JSON and some don't. ky does those steps once. A non-2xx answer throws an `HTTPError` that holds the body already read, so a form catches one error and hands `refusalOf(error)` to `responseErrorText`. No answer, and an answer that is not JSON, reach the same `catch` with nothing to read, and the form says something went wrong.

## Consequences

- `platformApi` turns off two of ky's defaults. `retry: 0`, because a Site settings or Birth save is a PUT that sends the `updatedAt` it read: a retry after a lost answer would reach a Site the first attempt already changed, and the route would answer 409 as if another tab had saved. `timeout: false`, because sending a Notification answers once every Subscription was tried, and a Birth video uploads in the request that saves it.
- ky hands `fetch` a `Request`, never a URL and options. A test that stubs `fetch` reads the method, the URL and the body from that `Request`.
- A `Request` needs an absolute URL outside a browser. `platformApi` resolves `/api/…` against the page's origin, and a test that runs in Node, where there is no page, passes `platformApi.extend({ baseUrl })`, as `fetchSiteEditingPort` lets it.
- A refusal's words still come from `errorText.ts` (ADR-0008). A form whose own words say a failure better, like the subscribe button's, uses a route's words only when they name a known error (`knownRouteErrorText`).
- On the server a failed call to another service is logged, even where the Platform carries on without its answer, and only as `outboundFailure(error)` words it: a status or an error's name. ky's errors hold the request with its headers and name its URL in their message, so logging one, or passing it on as a `cause`, writes a token, a Visitor's IP or a Site's words to Workers Logs.
- `ASSETS.fetch`, the Worker's binding to its own static files, is not an HTTP request to a service and stays as it is.
