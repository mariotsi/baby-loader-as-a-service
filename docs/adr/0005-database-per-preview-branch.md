# Preview deployments get one database per branch, on a non-production cluster

Every Vercel preview deployment of a branch writes to its own database, `waitingpages-<branch>` (`src/lib/dbName.ts`), on a cluster separate from production. MongoDB creates a database on its first write and the app creates its indexes on first connection, so a branch needs no provisioning, and one branch's data or schema changes never reach another. Production keeps its own cluster because preview deployments run unreviewed branch code, and MongoDB grants a user access to all databases or to named ones, never to a name prefix: a user able to create per-branch databases could also write to production's on the same cluster.

## Consequences

- A free Atlas cluster holds at most 100 databases and 500 collections; each branch uses three collections, so preview databases are dropped when their pull request closes or their branch is deleted (`.github/workflows/drop-preview-db.yml`).
- A preview database starts empty: each preview needs its own signup and Site to test with.
- Branch names that differ only in punctuation (`feat/x`, `feat-x`) share a database.
