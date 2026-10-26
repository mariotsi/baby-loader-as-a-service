import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { previewDbName, STAGING_DB_NAME } from '../src/lib/dbName.ts';
import { BASE_URL, bypassHeaders, e2ePassword, LOCAL_D1_PERSIST_TO } from './support/env.ts';

type Version = { env: 'production' | 'staging' | 'preview' | 'development'; branch: string | null };

/**
 * Asks the deployment which environment it is, refuses production, and
 * resets the test data in that deployment's D1 database: E2E fixtures
 * everywhere, demo data too except on staging (testDataPolicy has the final
 * word). Workers and the teardown inherit E2E_RUN_ID and the E2E_D1_*
 * target from here.
 */
export default async function globalSetup() {
  const res = await fetch(new URL('/api/version', BASE_URL), { headers: bypassHeaders() });
  if (!res.ok) {
    throw new Error(`${BASE_URL}/api/version answered ${res.status}`);
  }
  const version = (await res.json()) as Version;

  switch (version.env) {
    case 'production':
      throw new Error(`${BASE_URL} is production: E2E tests never run there`);
    case 'staging':
      process.env.E2E_D1_DATABASE = STAGING_DB_NAME;
      process.env.E2E_D1_REMOTE = '1';
      break;
    case 'preview':
      if (!version.branch) {
        throw new Error('The preview deployment reports no branch');
      }
      process.env.E2E_D1_DATABASE = previewDbName(version.branch);
      process.env.E2E_D1_REMOTE = '1';
      break;
    default:
      process.env.E2E_D1_DATABASE = STAGING_DB_NAME;
      process.env.E2E_D1_PERSIST_TO = LOCAL_D1_PERSIST_TO;
      delete process.env.E2E_D1_REMOTE;
  }

  process.env.E2E_RUN_ID = randomBytes(3).toString('hex');
  process.env.E2E_PASSWORD = e2ePassword();
  const where = process.env.E2E_D1_REMOTE ? 'remote' : 'local';
  console.log(
    `E2E run ${process.env.E2E_RUN_ID} against ${BASE_URL} (${version.env}, ${process.env.E2E_D1_DATABASE}, ${where})`
  );

  runDataScript(version.env === 'staging' ? ['reset'] : ['reset', '--demo']);
}

export function runDataScript(args: string[]) {
  execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/e2e-data.mjs', ...args], {
    stdio: 'inherit',
    env: process.env,
  });
}
