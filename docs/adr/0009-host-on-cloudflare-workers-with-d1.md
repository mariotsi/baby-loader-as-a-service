# The app runs on Cloudflare Workers and keeps its data in D1

The app is a Cloudflare Worker built with `@opennextjs/cloudflare`, on the Workers Paid plan, and its data lives in Cloudflare D1. The app takes payments, and Vercel's Hobby plan is for non-commercial use only; Workers Paid allows commercial use for $5/month per account, with no bandwidth charges, and puts the app, its data, DNS, media (R2, Stream) and Custom domains (Cloudflare for SaaS) with one provider. The Workers Free plan doesn't fit: its 10 ms of CPU per request is less than one password hash or a server-rendered page takes.

D1 replaces MongoDB because a Worker can't reuse a socket across requests: a MongoDB client would open a new TCP, TLS and SCRAM connection on every request, measured at about 270 ms against Atlas, while D1 is reached through a binding with no connection to open. Workers KV doesn't fit the data, being eventually consistent with no unique constraints or queries, and Durable Objects would leave the data's partitioning to the app.

Two Workers keep production apart from unreviewed branch code: `loading-baby` serves `main` on `loading.baby` and binds the database `waitingpages`; `loading-baby-staging` serves `staging` on its own staging domain with `waitingpages-staging`, and runs one Preview per other branch, each with its own database `waitingpages-<branch>`. Previews sit behind Cloudflare Access and serve Sites by path, since `workers.dev` has no wildcard subdomains.

## Consequences

- Schema changes are SQL migrations in `migrations/`, applied by the deploy before the new code goes live; a migration must keep working with the code still serving, since gradual deployments and `wrangler rollback` run the previous version against the new schema.
- The deploy workflow creates a branch's database on its first push, migrates it, and deletes it when the pull request closes or the branch is deleted. Workers Paid allows 50,000 D1 databases of up to 10 GB each; the Free plan's 10 would leave room for only 8 Previews.
- D1 has no interactive transactions: writes that belong together go in one `db.batch()`.
- Ids are 24-character hex strings, the format MongoDB's ObjectIds had, so rows copied from Atlas keep their ids and existing sessions (ADR-0003) stay valid.
- Cloudflare's free Universal SSL covers `loading.baby` and one level of subdomains, so Sites at `<slug>.loading.baby` need nothing more; a two-level name such as `<slug>.staging.loading.baby` would need Advanced Certificate Manager, which is why staging has a domain of its own.
- The rate limiter and the geoip cache stay in memory per isolate, which makes them best-effort across Cloudflare's many isolates.
- One Cloudflare account holds production and non-production, and an API token can't be limited to some Workers or databases, so the token that deploys Previews could reach production's database. Push-triggered workflows run with it, so anyone with write access to the repository could misuse it. Production's database id lives only in a GitHub environment restricted to `main`; separate accounts would close the gap fully, at $5/month more.
- The data layer depends on Cloudflare: leaving it means moving off D1, though the schema is plain SQLite.
