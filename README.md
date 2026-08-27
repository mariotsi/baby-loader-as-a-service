# baby-loader-as-a-service

Multi-tenant "waiting page" SaaS: customers create their own customizable
baby countdown/announcement page — pick a color palette and font, choose
whether to show the baby's name and/or sex, set the language (English,
Italian, or both with a switcher) — get an admin dashboard and a shareable
subdomain link, and push notifications to send updates to visitors.

This is a **separate, independent project** inspired by
[`baby-loader`](https://github.com/mariotsi/baby-loader), a single-tenant
personal project. `baby-loader` is not modified by this repo in any way, and
the two apps use **separate MongoDB databases** — see "Isolation from
baby-loader" below. A handful of framework-agnostic utilities
(`webpush.ts`, `vapid.ts`, `geoip.ts`, `deviceInfo.ts`, `rateLimit.ts`,
`i18n.ts`, `public/sw.js`) were copied over from baby-loader as a starting
point and adapted; from here the two codebases evolve independently.

## Stack

Next.js 16 (App Router) + TypeScript, MongoDB Atlas, Web Push (VAPID).
Intended to deploy on Vercel (see "Hosting" below).

## How multi-tenancy works

- **Tenant data model** (`src/lib/tenant.ts`): a `tenants` collection holds
  each site's slug, owner, baby info, theme, privacy toggles, language mode,
  and (future) custom domain. `subscriptions` (`src/lib/subscription.ts`) is
  scoped by `tenantId`.
- **Subdomain routing** (`src/middleware.ts`): reads the request's `Host`
  header and rewrites `slug.yourdomain.com/*` to the internal
  `/sites/[slug]` route (`src/app/sites/[slug]/page.tsx`), which looks the
  tenant up by slug and renders its public page. The root domain (and
  `localhost` in dev) is untouched and serves the marketing site / accounts /
  admin instead. No database lookup happens in middleware — the string
  parsing there stays cheap, and an unknown slug 404s inside the page itself.
- **Accounts** (`src/lib/auth.ts`): email/password accounts with hashed
  passwords (scrypt) and a signed session cookie — no shared admin password.
  Every tenant has an `ownerId`; admin routes and pages check ownership
  before allowing reads/writes.
- **Theming** (`src/lib/theme.ts`): a curated list of palettes and Google
  Fonts, not free-form CSS — keeps every tenant site fast, safe, and cheap.
  Applied as CSS custom properties (see `src/app/globals.css`).
- **Push notifications**: one shared VAPID keypair for the whole platform;
  `subscriptions` are scoped by tenant so a "send notification" only reaches
  that tenant's subscribers.

## What's implemented vs. what's next

Implemented: accounts, tenant creation/onboarding, subdomain routing, theming
(palette + font), name/sex visibility toggles, language mode (mono or
switcher), due-date countdown + milestones, born-state fields, per-tenant
push notifications and subscriber list.

Deliberately not yet built (see the original planning discussion):
- **Custom domains (CNAME)** — needs the Vercel Domains API behind a
  `DomainProvider` abstraction so it isn't a hard Vercel lock-in; not started.
- **Media storage** — tenant-uploaded hero photo/video and a custom OG/share
  image; the public page currently has no hero media at all. Needs a small
  storage abstraction (Vercel Blob or an S3-compatible provider).
- **Billing** — no Stripe integration; site creation is free/manual for now.
- Fuller push-notification UX copy (iOS "add to home screen" instructions,
  per-OS "notifications are blocked" troubleshooting) — baby-loader has a
  much more detailed version of this that's a good candidate to port over.

## Isolation from baby-loader

- Separate GitHub repo, separate `package.json`, no shared imports.
- Separate MongoDB **database** by default (`waitingpages`, see
  `src/lib/mongodb.ts`, vs. baby-loader's `pushnotify`) — use a genuinely
  separate cluster/Atlas project too if you want stronger isolation than a
  same-cluster, different-database setup provides.
- Separate VAPID keypair, separate `SESSION_SECRET`, separate deployment.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in MONGODB_URI, SESSION_SECRET, VAPID keys
npm run generate-vapid              # prints VAPID keys to paste into .env.local
npm run dev
```

In dev, `localhost:3000` serves the marketing/account/admin app. Tenant
subdomains need a resolvable `ROOT_DOMAIN` — most browsers resolve
`*.localhost` locally, so you can test a tenant at `slugname.localhost:3000`
once `ROOT_DOMAIN=localhost` is set. In production, set `ROOT_DOMAIN` to your
real domain (e.g. `example.com`) and point a wildcard DNS record
(`*.example.com`) at your deployment.

## Hosting

Intended for Vercel, which has native support for the wildcard-subdomain +
per-tenant-custom-domain pattern this app is built around. Before relying on
custom domains for real customers, confirm current Vercel pricing/limits for
programmatic domain management against expected tenant volume — this was
flagged as a cost item to verify, not yet done.
