import { runDataScript } from './global-setup.ts';
import { runId } from './support/env.ts';

/** Deletes what this run created, and any run's leftovers older than a day. */
export default function globalTeardown() {
  runDataScript(['cleanup', runId()]);
}
