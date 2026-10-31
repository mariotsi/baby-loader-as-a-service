# baby-loader-as-a-service

Multi-Site "waiting page" SaaS: customers create their own customizable
baby countdown/announcement page — pick a color palette and font, choose
whether to show the baby's name and/or sex, set the language (English,
Italian, or both with a switcher) — get a Dashboard and a shareable
subdomain link, and push notifications to send updates to visitors.

This is a **separate, independent project** inspired by
[`baby-loader`](https://github.com/mariotsi/baby-loader), a single-Site
personal project. `baby-loader` is not modified by this repo in any way, and
the two apps keep **separate data** — see "Isolation from
baby-loader" below. A handful of framework-agnostic utilities
(`webpush.ts`, `vapid.ts`, `geoip.ts`, `deviceInfo.ts`, `rateLimit.ts`,
`i18n.ts`, `public/sw.js`) were copied over from baby-loader as a starting
point and adapted; from here the two codebases evolve independently.

## Stack

Next.js 16 (App Router) + TypeScript on Cloudflare Workers, Cloudflare D1
through Drizzle ORM, Web Push (VAPID). See ADR-0009.

## How Sites work

- **Site data model** (`src/db/schema.ts`, `src/lib/site.ts`): a `sites`
  table holds each Site's Slug, Owner, Site settings
  (`src/lib/siteSettings.ts`, one JSON column), and (future) Custom domain.
  `subscriptions` (`src/lib/subscription.ts`) is scoped by `site_id`.
- **Addresses** (`src/lib/address.ts`, applied by `src/proxy.ts`): one
  module turns a Slug into its Address and a request's `Host` and path back
  into a Site. `slug.yourdomain.com/*` is rewritten to the internal
  `/sites/[slug]` route (`src/app/sites/[slug]/page.tsx`), which looks the
  Site up by Slug and renders its Public page; a `/sites/<slug>` path on any
  other host redirects to the Site's Address, so each Site keeps one origin.
  The root domain (and `localhost` in dev) serves the marketing site,
  accounts and Dashboard. The proxy queries no database, and an unknown Slug
  404s inside the page itself. Address also owns which Slugs are allowed:
  their format and the Reserved slugs.
- **Accounts** (`src/lib/auth.ts`): email/password accounts with hashed
  passwords (scrypt) and a signed session cookie — no shared password.
  Every Site has an `ownerId`; Owner access (`src/lib/ownerAccess.ts`) checks
  it for every Dashboard route and page before any read or write.
- **Theming** (`src/lib/theme.ts`): a curated list of palettes and Google
  Fonts, not free-form CSS — keeps every Site fast, safe, and cheap.
  Applied as CSS custom properties (see `src/app/globals.css`).
- **Push notifications**: one shared VAPID keypair for the whole platform;
  `subscriptions` are scoped by Site so a Notification only reaches that
  Site's Subscribers.

## What's implemented vs. what's next

Implemented: accounts, Site creation/onboarding, subdomain routing, theming
(palette + font), name/sex visibility toggles, language mode (mono or
switcher), due-date countdown + milestones, born-state fields, per-Site
push notifications, the list of a Site's Subscriptions and the R2-backed
media storage layer, birth video uploads and the welcome video reveal.

Owner uploads live under `customer-data/<owner-id>/<site-id>/`; application-managed
website files use `website-assets/`. Deletion requires an authenticated `OwnedSite`
and accepts keys only from that owner's Site folder.

The Owner media API is `POST` and `DELETE /api/sites/<slug>/media`. `POST`
accepts multipart form data with a `file` field and returns its object key and
public URL. It accepts AVIF, JPEG, PNG and WebP images up to 5 MB, and MP4 or
WebM video up to 50 MB. `DELETE` accepts a JSON `{ "key": "..." }` body;
deletion purges the file's public URL from Cloudflare's cache.

The Site editor holds the welcome video selection locally until the Owner saves.
The Owner can pick it before the birth, ready for the day; the Public page plays it only in the Born state.
The welcome video opens in a full-screen dialog once per browser, and the Born
page offers a replay button. The editor
provides an explicit video preview. On Preview deployments, published birth media
is served on the page origin from R2, including byte-range video requests. Replaced and removed files are deleted after
the Site settings save succeeds. Birth photo selection in the Send birth
notification flow is tracked in [#15](https://github.com/mariotsi/baby-loader-as-a-service/issues/15).

Deliberately not yet built (see the original planning discussion):
- **Custom domains (CNAME)** — needs a Cloudflare-specific domain verification
  and routing flow; not started.
- **Billing** — no Stripe integration; site creation is free/manual for now.
- Fuller push-notification UX copy (iOS "add to home screen" instructions,
  per-OS "notifications are blocked" troubleshooting) — baby-loader has a
  much more detailed version of this that's a good candidate to port over.

## Isolation from baby-loader

- Separate GitHub repo, separate `package.json`, no shared imports.
- Separate **database**: its own D1 databases (`loading-baby` and the
  others in "Environments").
- Separate VAPID keypair, separate `SESSION_SECRET`, separate deployment.

## Local development

```bash
npm install
npm run db:migrate                  # creates the local D1 in .wrangler/state
cp .env.local.example .env.local    # then fill in SESSION_SECRET and the VAPID keys
npm run generate-vapid              # prints VAPID keys to paste into .env.local
npm run dev
```

`npm run dev` gets the Worker's bindings from `wrangler.jsonc`, with the
local D1 that `npm run db:migrate` prepares; no database server runs.
`npm run seed` adds demo Owners and Sites to it:
`demo-owner-a@waitingpages.test` and `demo-owner-b@waitingpages.test`,
password `waiting-pages-demo`.
`npm run cf:preview` builds and runs the app as the Worker it deploys as,
with the variables in `.dev.vars` (see `.dev.vars.example`).

The server checks its environment variables when it starts
(`src/lib/env.ts`) and refuses to start, naming each one, when a variable is
missing or malformed; `next build` needs none of them.

`localhost:3000` serves the Platform, and each Site its Address at
`<slug>.localhost:3000` (browsers resolve `*.localhost` to this machine).

[Biome](https://biomejs.dev) lints and formats the code (`biome.json`):
`npm run lint` checks, `npm run format` fixes what it can. `npm install`
sets up a [lefthook](https://lefthook.dev) pre-commit hook (`lefthook.yml`)
that runs Biome on the staged files, and CI runs the same checks with
`biome ci`.

No local setup reaches a remote database: `npm run dev` and `npm run
cf:preview` both use the local D1.

## Design system

Every page is built from the components in `src/components/ui`, styled only
through design tokens: `src/lib/theme.ts` holds the Palettes and Fonts that
set the color and typography tokens, `src/styles/tokens.css` everything no
theme changes. [Storybook](https://storybook.js.org) shows each component,
the rules for using and adding them, a Playground with every component in
any Palette and Font, and the real pages with sample content.

```bash
npm run storybook          # Storybook on localhost:6006
npm run test:storybook     # every story in Chromium, failing on any axe violation
npm run build-storybook    # a static Storybook in storybook-static/
```

`npm test` also checks every Palette against WCAG AA on each color pairing
the components render, and CI runs both checks on every pull request.

## Brand

The Platform is **Loading Baby**, at `loading.baby`, with the tagline "For
the days before the big day" ("Per i giorni prima del grande giorno"). Its
mark is the Sleepy spinner: a baby asleep inside a loading ring, the curl on
its head where the ring starts. In the app it is the `Logo` in every Platform
header and the `Spinner` that shows wherever work is in flight.

`brand/` holds the brand kit, for anything outside the app: slides, social
posts, print, a press page.

| Folder          | What                                                                        |
| --------------- | --------------------------------------------------------------------------- |
| `brand/Logo`    | 4 marks and 12 lockups, each as SVG, PNG on transparent and JPG             |
| `brand/Favicon` | `favicon.ico`, `icon.svg`, PNG favicons, app icons, push notification badge |
| `brand/Social`  | Open Graph images, 1200 × 630, marketing and Dashboard, English and Italian |

The marks are full color, on dark, one color and white. The lockups are
horizontal and stacked, with no tagline, the English or the Italian one, on
light and on dark. The SVGs carry the name as outlines, so they need no fonts.

The kit is built from code, so never edit its files by hand: change
`scripts/brand-kit.mjs` and run

```bash
npm run brand              # rebuilds brand/ and the app's copies below
```

The same run copies what the app serves out of the kit:

| App file                                | From                                      |
| --------------------------------------- | ----------------------------------------- |
| `public/favicon.ico`                    | `brand/Favicon/favicon.ico`               |
| `src/app/icon.svg`                      | `brand/Favicon/icon.svg`                  |
| `src/app/apple-icon.png`                | `brand/Favicon/apple-touch-icon.png`      |
| `src/app/opengraph-image.png`           | `brand/Social/og-marketing-en.png`        |
| `src/app/dashboard/opengraph-image.png` | `brand/Social/og-dashboard-en.png`        |
| `public/icon-192.png`                   | `brand/Favicon/icon-192.png`              |
| `public/icon-512.png`                   | `brand/Favicon/icon-512.png`              |
| `public/icon-maskable-512.png`          | `brand/Favicon/icon-maskable-512.png`     |
| `public/icon-72.png`                    | `brand/Favicon/notification-badge-72.png` |

The `Logo` and `Spinner` components draw the mark in code, with the theme's
tokens (`LogoMark` in `src/components/ui/Logo.tsx`): a change to the mark goes
in both the script and that component. A Site's icon is the Platform's
loading baby, or an emoji its Owner picks, drawn on the Site's Palette (see
`src/lib/siteMeta.ts`).

## End-to-end tests

Playwright tests in `e2e/` cover signup and Site creation, login, the Public
page in each state, Privacy settings and Languages, Site settings,
Subscriptions and Notifications, and that an Owner cannot reach another
Owner's Sites. They run in Chromium (desktop) and WebKit (iPhone).

```bash
npm run e2e              # builds the Worker and runs it on :3100, with its own local D1
npm run e2e:staging      # against staging, needs .env.staging.local
npm run e2e:report       # opens the last HTML report
```

Before a run the suite asks the deployment which environment it is
(`/api/version`), refuses production, and resets its fixtures in that
deployment's D1 database through `wrangler d1 execute`
(`scripts/e2e-data.mjs`); afterwards it deletes what it created. A local run
uses the local D1 in `.wrangler/e2e`, apart from the one `npm run dev` uses;
a deployed one needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
ADR-0006 has the data rules.

In CI, `.github/workflows/deploy-preview.yml` and `deploy-staging.yml` run
the suite (job `e2e`) after every deploy they make: each pull request branch's Preview, whose check shows on the pull
request, and staging, where a pass promotes the commit to production (see
"Environments"). The job takes its secrets from the GitHub environment `Preview`, without
recording a deployment there, which holds `CLOUDFLARE_API_TOKEN` (the data script writes the fixtures to the
deployment's D1 database), `E2E_PASSWORD` (fixture Owners), and
`CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` (an Access service
token, to get through Cloudflare Access on staging and Previews). On a
Preview the workflow passes the pool database its branch holds as
`E2E_D1_DATABASE`.

The job runs in Playwright's Docker image
(`mcr.microsoft.com/playwright:v<version>-noble`), which ships the browsers
and their system dependencies for one Playwright release. Its tag must equal
the exact `@playwright/test` version in `package.json`: CI checks it on every
pull request (`scripts/check-playwright-image.mjs`), so an upgrade changes
both together.

## Hosting

Cloudflare Workers, through the `@opennextjs/cloudflare` adapter, with data
in Cloudflare D1 and media in Cloudflare R2 (ADR-0009). Production, staging,
and Previews run on Cloudflare Workers. Custom domains per Site are meant
for Cloudflare for SaaS custom hostnames ([#16](https://github.com/mariotsi/baby-loader-as-a-service/issues/16)).

## Environments

Two Workers keep production apart from everything else: `loading-baby`
(`wrangler.production.jsonc`) serves `main`, and `loading-baby-staging`
(`wrangler.jsonc`) serves `staging` and a Preview of every other branch.
Changes reach production through staging only: pull requests merge into
`staging`, the default branch, and `main` receives the exact commit that
passed the E2E suite on staging. Three GitHub Actions workflows deploy
them, each on its own branches only: "Deploy to production"
(`deploy-production.yml`, `main`), "Deploy to staging" (`deploy-staging.yml`,
`staging`) and "Deploy to preview" (`deploy-preview.yml`, every other
branch). Each calls the reusable `deploy.yml`, whose job runs in the GitHub
environment `Production`, `Staging` or `Preview`, so every deploy is recorded
as a deployment of that environment, with its address.

| Environment | Worker                                 | Branch               | Addresses                                                                        | D1 database                                                 |
| ----------- | -------------------------------------- | -------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Production  | `loading-baby`                         | `main`               | `loading.baby`, Sites at `<slug>.loading.baby`                                   | `loading-baby`                                              |
| Staging     | `loading-baby-staging`                 | `staging`            | `staging-loading-baby.fyi`, Sites at `<slug>.staging-loading-baby.fyi`           | `loading-baby-staging`                                      |
| Preview     | `loading-baby-staging`, one per branch | any other but `main` | `<branch>-loading-baby-staging.simone-716.workers.dev`, Sites at `/sites/<slug>` | one of `loading-baby-preview-1` to `-5`, lent to the branch |
| Local       | none                                   | any                  | `localhost:3000`, Sites at `<slug>.localhost:3000`                               | local D1 in `.wrangler/state`                               |
- **Who deploys what**: a push to `staging` migrates `loading-baby-staging`
  and runs `wrangler deploy`; a push to any other branch but `main` claims a
  pool database, migrates it and runs `wrangler preview`. `main` gets no
  Preview: it only receives commits whose `e2e` passed on staging. A push to
  `main` migrates `loading-baby` and deploys the production Worker.
- **Credentials**: Previews run unreviewed branch code, so production's
  secrets (`SESSION_SECRET`, the VAPID keypair) exist only on `loading-baby`,
  and its API token only in the GitHub environment `Production`, restricted
  to `main`. Staging's token sits in the environment `Staging`, which deploys
  `staging`, and again in `Preview`, beside the Access service token and
  `E2E_PASSWORD`; the E2E suite and `drop-preview-db.yml` use `Preview` without
  recording a deployment. Within a deployment every Site shares one
  keypair (ADR-0002).
- **Preview pool** (`PREVIEW_POOL` in `src/lib/dbName.ts`,
  `scripts/preview-pool.mjs`): five D1 databases created once by hand. A
  branch's first push takes the first free one, recorded in its
  `preview_slot` table, and later pushes keep it and its data.
  `.github/workflows/drop-preview-db.yml` deletes the Preview and empties the
  database (every table, the migrations table included) when the pull
  request closes or the branch is deleted. With every database taken, a new
  branch's deploy fails before deploying, naming the branches that hold them;
  grow the pool by creating `loading-baby-preview-6` and adding it to
  `PREVIEW_POOL`. CI never creates or deletes a database.
- **Preview link**: each pull request gets one comment with its Preview's
  link and the latest deployment's own address, edited on every push
  (`scripts/preview-comment.mjs`).
- **Root domain** (`src/lib/address.ts`): every Worker sets `ROOT_DOMAIN`; a
  Preview gets its own `workers.dev` host, which has no wildcard subdomains,
  so it serves Sites by path. Subdomain routing is exercised on staging.
- **Cloudflare Access**: staging, its Sites and every Preview sit behind
  Access (Zero Trust team `loading-baby`): only the owner signs in, by email
  code, and CI gets through with the service token.
- **Environment ribbon** (`src/lib/appEnv.ts`): every page names its
  environment in a corner ribbon, except in production.
- **Reserved slug**: `staging` stays a Reserved slug.

### From pull request to production

1. A pull request targets `staging`. `.github/workflows/ci.yml` runs type
   checking, Biome's lint and format check, unit tests and the Worker build
   (job `ci`), and `deploy-preview.yml` deploys the branch's Preview and runs the E2E
   suite on it (job `e2e`). Both are required before it merges.
2. Merging deploys `staging`: `deploy-staging.yml` applies the new D1 migrations to
   `loading-baby-staging`, deploys the Worker, then runs the E2E suite against
   `staging-loading-baby.fyi` once it serves that commit.
3. When the suite passes, job `promote` fast-forwards `main` to that commit
   (`git push origin <sha>:main`), which production deploys. Nothing is
   merged or rebuilt from other sources on the way: production runs the
   commit staging tested.

Staging runs one at a time: a newer push to `staging` cancels the run of an
older one, and its promotion carries the older commits along. A failed E2E
run leaves `main` where it is until a later staging commit passes, or until
the failed run is re-run.

### What guards `main`

- **Ruleset "Require E2E on main"**: every commit `main` receives needs a
  successful `e2e` check from GitHub Actions. It has no bypass actors.
- **Ruleset "Only promotion updates main"**: restricts updates and blocks
  force pushes and deletion. Its bypass actor is the repository's deploy
  keys, and the only one is `promote-main`, with write access: its private
  half is the repository secret `PROMOTE_DEPLOY_KEY`, which `promote` pushes
  with. Nobody pushes or merges to `main` by hand, and adding another write
  deploy key would let it bypass too.
- **Ruleset "Require CI and E2E on staging"**: a pull request merges into
  `staging` only once its head commit has a successful `ci` check and a
  successful `e2e` check from its Preview, and force pushes and deletion are
  blocked. Pull requests merge by squash only, titled after the pull
  request.
- **Fast-forward only**: `promote` never force pushes. If `main` holds a
  commit `staging` lacks, it fails until `main` is merged into `staging`,
  and a commit `main` already contains is left alone.

### Data migrations

The schema lives in `src/db/schema.ts`. `npm run db:generate` turns a change
there into a SQL migration in `migrations/`, named `NNNN_short_name.sql`,
which is committed with the change. `npm run db:migrate` applies new ones to
the local D1, and every deploy applies them to its environment's database
with `wrangler d1 migrations apply` before the new code goes live; D1 records
each applied migration in its `d1_migrations` table, so each runs once per
database.
- **Compatibility**: a gradual deployment or `wrangler rollback` runs the
  previous code on the migrated schema. So a migration only makes changes the
  previous code still reads correctly: add a column before reading it, stop
  writing one before dropping it.
- **No interactive transactions**: D1 has none.
  Writes that belong together go in one `db.batch()`.
