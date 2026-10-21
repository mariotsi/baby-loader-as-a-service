import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { previewDbName, STAGING_DB_NAME } from '../src/lib/dbName.ts';
import { BASE_URL, bypassHeaders, e2ePassword, LOCAL_E2E_DB_NAME, LOCAL_MONGODB_URI } from './support/env.ts';

type Version = { env: 'production' | 'staging' | 'preview' | 'development'; branch: string | null };

/**
 * Asks the deployment which environment it is, refuses production, and
 * resets the test data in that deployment's database: E2E fixtures
 * everywhere, demo data too except on staging (testDataPolicy has the final
 * word). Workers inherit E2E_RUN_ID and E2E_DB_NAME from here.
 */
export default async function globalSetup() {
  const res = await fetch(new URL('/api/version', BASE_URL), { headers: bypassHeaders() });
  if (!res.ok) {
    throw new Error(`${BASE_URL}/api/version answered ${res.status}`);
  }
  const version = (await res.json()) as Version;

  let dbName: string;
  let mongoUri = process.env.E2E_MONGODB_URI;
  switch (version.env) {
    case 'production':
      throw new Error(`${BASE_URL} is production: E2E tests never run there`);
    case 'staging':
      dbName = STAGING_DB_NAME;
      break;
    case 'preview':
      if (!version.branch) {
        throw new Error('The preview deployment reports no branch');
      }
      dbName = previewDbName(version.branch);
      break;
    default:
      dbName = process.env.E2E_DB_NAME || LOCAL_E2E_DB_NAME;
      mongoUri ??= LOCAL_MONGODB_URI;
  }
  if (!mongoUri) {
    throw new Error(`Set E2E_MONGODB_URI to the cluster of ${BASE_URL} (${version.env})`);
  }

  process.env.E2E_RUN_ID = randomBytes(3).toString('hex');
  process.env.E2E_DB_NAME = dbName;
  process.env.E2E_MONGODB_URI = mongoUri;
  process.env.E2E_PASSWORD = e2ePassword();
  console.log(`E2E run ${process.env.E2E_RUN_ID} against ${BASE_URL} (${version.env}, ${dbName})`);

  runDataScript(version.env === 'staging' ? ['reset'] : ['reset', '--demo']);
}

export function runDataScript(args: string[]) {
  execFileSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/e2e-data.mjs', ...args],
    { stdio: 'inherit', env: process.env }
  );
}
