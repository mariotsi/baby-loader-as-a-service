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

Needs Docker (on macOS, [Colima](https://github.com/abiosoft/colima) works:
`brew install colima docker docker-compose && colima start`).

```bash
npm install
npm run db:up                       # MongoDB in Docker, data kept in a volume
cp .env.local.example .env.local    # then fill in SESSION_SECRET and the VAPID keys
npm run generate-vapid              # prints VAPID keys to paste into .env.local
npm run seed                        # optional: demo Owners and Sites
npm run dev
```

`localhost:3000` serves the Platform, and each Site its Address at
`<slug>.localhost:3000` (browsers resolve `*.localhost` to this machine).
`npm run seed` creates `demo-owner-a@waitingpages.test` and
`demo-owner-b@waitingpages.test`, password `waiting-pages-demo`.

`npm run dev:staging` runs the local app on staging's database instead, with
the credentials in `.env.staging.local` (see `.env.staging.local.example`).
No local setup reaches production's database.

## End-to-end tests

Playwright tests in `e2e/` cover signup and Site creation, login, the Public
page in each state, Privacy settings and Language mode, Site settings,
Subscribers and Notifications, and that an Owner cannot reach another
Owner's Sites. They run in Chromium (desktop) and WebKit (iPhone).

```bash
npm run db:up
npm run e2e              # builds and starts the app on :3100, database waitingpages-e2e
npm run e2e:staging      # against staging.loading.baby, needs .env.staging.local
npm run e2e:report       # opens the last HTML report
```

Before a run the suite asks the deployment which environment it is
(`/api/version`), refuses production, and resets its fixtures in that
deployment's database; afterwards it deletes what it created. ADR-0006 has
the data rules.

In CI, `.github/workflows/e2e.yml` runs the suite on every deployment of
the `baby-loader-staging` project once Vercel reports it to GitHub as ready:
each preview, whose check shows on the pull request, and staging. Both
Vercel projects create GitHub Deployments; the workflow ignores the
production project's. It needs three repository secrets:
`PREVIEW_MONGODB_URI` (non-production cluster), `E2E_PASSWORD` (fixture
Owners) and `VERCEL_AUTOMATION_BYPASS_SECRET` (the staging project's
Protection Bypass for Automation, to get past Deployment Protection on its
`vercel.app` URLs).

## Hosting

Intended for Vercel, which has native support for the wildcard-subdomain +
per-tenant-custom-domain pattern this app is built around. Before relying on
custom domains for real customers, confirm current Vercel pricing/limits for
programmatic domain management against expected tenant volume — this was
flagged as a cost item to verify, not yet done.

## Environments

Two Vercel projects keep production apart from everything else: the
production project builds only `main`, and the staging project builds
`staging` and every other branch.

| Environment | Vercel project | Branch | Addresses | MongoDB |
|---|---|---|---|---|
| Production | `baby-loader-as-a-service` | `main` | `loading.baby`, Sites at `<slug>.loading.baby` | production cluster, database `waitingpages` |
| Staging | `baby-loader-staging` (its production branch) | `staging` | `staging.loading.baby`, Sites at `<slug>.staging.loading.baby` | non-production cluster, database `waitingpages-staging` |
| Preview | `baby-loader-staging` (its preview deployments) | any other, `main` included | the branch's `baby-loader-staging-git-…vercel.app` URL, Sites at `/sites/<slug>` | non-production cluster, database `waitingpages-<branch>` |
| Local | none | any | `localhost:3000`, Sites at `<slug>.localhost:3000` | Docker MongoDB, database `waitingpages-dev` |

- **Who builds what**: the production project's Ignored Build Step skips
  every deployment but production, so it never builds a preview. The staging
  project has `staging` as its production branch and builds a preview of
  every other push.
- **Credentials**: preview deployments run unreviewed branch code, so
  production's `MONGODB_URI`, `SESSION_SECRET` and VAPID keypair exist only in
  the production project, Production scope. The staging project holds the
  non-production cluster's `MONGODB_URI`, a `SESSION_SECRET` and a VAPID
  keypair for its Production and Preview scopes; within a deployment every
  Site shares one keypair (ADR-0002).
- **Database per deployment** (`src/lib/dbName.ts`): production and staging
  set `MONGODB_DB_NAME`; a preview, which does not, uses
  `waitingpages-<branch>`. Production refuses to start without
  `MONGODB_DB_NAME`, and anywhere else an unset name falls back to
  `waitingpages-staging`, never to production's. MongoDB creates a database
  on its first write, and the first request of each process creates the
  indexes (`src/lib/indexes.ts`), so a new branch needs no setup. The
  workflow `.github/workflows/drop-preview-db.yml` drops a preview's database
  when its pull request closes or its branch is deleted, using the repository
  secret `PREVIEW_MONGODB_URI` (non-production cluster).
- **Root domain** (`src/lib/tenantUrl.ts`): production and staging set
  `ROOT_DOMAIN`. A preview leaves it unset and uses its branch URL, a
  `vercel.app` host without wildcard subdomains, so it serves Sites by path;
  subdomain routing is exercised on staging.
- **Deployment Protection**: both projects require a Vercel login on every
  `vercel.app` URL and leave their custom domains public, so staging is
  public and previews are not. CI gets past the protection on previews with
  the staging project's Protection Bypass for Automation, stored as the
  repository secret `VERCEL_AUTOMATION_BYPASS_SECRET`.
- **Environment ribbon** (`src/lib/appEnv.ts`): every page names its
  environment in a corner ribbon, except in production.
- **Reserved slug**: `staging` is a Reserved slug, since `staging.loading.baby`
  serves the staging Platform.
