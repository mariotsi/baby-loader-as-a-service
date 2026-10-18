# Sessions are signed cookies with no server-side store

A session is an HMAC-SHA256 signed cookie carrying the User id and an expiry 30 days out, verified with `SESSION_SECRET` on every request (`src/lib/auth.ts`); the database holds no session records. This needs no session collection and no database lookup to authenticate a request, and reads the same in Server Components and route handlers.

## Consequences

- A single session cannot be revoked before it expires: logout clears the cookie in that browser only, and a stolen cookie stays valid until its expiry.
- Rotating `SESSION_SECRET` is the only way to end sessions early, and it signs out every User at once.
