# Preview deployments get one database per branch, on a non-production cluster

**Superseded** by ADR-0009 for the database: Previews run on Cloudflare Workers and each borrows a D1 database from a fixed pool (`PREVIEW_POOL` in `src/lib/dbName.ts`).

Every Vercel preview deployment of a branch writes to its own database, `waitingpages-<branch>` (`src/lib/dbName.ts`), on a cluster separate from production. MongoDB creates a database on its first write and the app creates its indexes on first connection, so a branch needs no provisioning, and one branch's data or schema changes never reach another. Production keeps its own cluster because preview deployments run unreviewed branch code, and MongoDB grants a user access to all databases or to named ones, never to a name prefix: a user able to create per-branch databases could also write to production's on the same cluster.

## Consequences

- A free Atlas cluster holds at most 100 databases and 500 collections; each branch uses up to four collections, so preview databases are dropped when their pull request closes or their branch is deleted (`.github/workflows/drop-preview-db.yml`).
- A preview database starts with the E2E fixtures and demo data the E2E workflow writes (ADR-0006).
- Branch names that differ only in punctuation (`feat/x`, `feat-x`) share a database.
