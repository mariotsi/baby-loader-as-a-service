# One VAPID keypair for the whole Platform

Every Site sends Notifications with the same VAPID keypair, and Subscribers are scoped to one Site by `tenantId` on each subscription document. One keypair keeps key management to a single set of environment variables and lets the service worker and subscribe flow stay identical on every Site; separate keypairs per Site would add per-Site secrets for no isolation the Subscriber scoping does not already give.

## Consequences

- Each browser subscription is bound to the public key it was created with. Rotating the keypair invalidates every Subscriber on every Site, so the key is rotated only on compromise, with Visitors asked to subscribe again.
