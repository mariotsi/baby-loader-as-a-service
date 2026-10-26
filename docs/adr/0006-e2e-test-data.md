# E2E tests run on fixed fixtures, and clean up what they create

The Playwright suite (`e2e/`) runs unchanged on a local server, on every preview deployment and on staging, so its data cannot depend on a database being empty or on a person having set something up. Before each run the data script (`scripts/e2e-data.mjs`) resets a fixed set of fixtures: two Owners, `e2e-owner-a` and `e2e-owner-b`, and Sites with `e2e-` Slugs, deleted and inserted afresh. Tests that only read share them; a test that changes a Site has its own, one per Playwright project, so parallel browsers never touch the same Site. Tests that must create data, such as signup, give it an `e2e-run-<runId>-` email or Slug, and the run's teardown deletes exactly that, plus any run's leftovers older than a day.

Fixtures stay on staging between runs because staging needs the same starting state as everywhere else; being a fixed set, they never accumulate. Demo data (`demo-` Owners and Sites, for people reviewing a preview by hand) is written to previews and local databases only. `testDataPolicy` (`src/lib/dbName.ts`) enforces both rules and refuses every other D1 database, production's included, before writing anything. The script writes through `wrangler d1 execute`, one batch per run, so the fixtures follow the same schema and migrations as the app.

## Consequences

- Staging always holds the fixture Sites (`e2e-…`) and their two Owners, whose password is the `E2E_PASSWORD` repository secret.
- Every preview starts with demo data: Owners `demo-owner-a@waitingpages.test` and `demo-owner-b@waitingpages.test`, password `waiting-pages-demo`.
- The suite never runs against production: it asks the deployment (`/api/version`) which environment it is and stops on production.
- Browsers in CI have no push service, so the suite replaces it in the page (`fakePushService`): Subscriptions and sending are exercised, delivery to a device is not.
- Login and signup allow 10 attempts a minute per IP. Fixture Owners log in once per run, and tests of those endpoints run in one browser only.
