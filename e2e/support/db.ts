import { execFileSync } from 'node:child_process';

/**
 * Direct access to the D1 database of the deployment under test, which the
 * global setup names in E2E_D1_DATABASE (remote when E2E_D1_REMOTE is set,
 * else the local one in E2E_D1_PERSIST_TO), for what no page shows: a User's
 * stored password hash.
 */
function query(sql: string): Record<string, unknown>[] {
  const dbName = process.env.E2E_D1_DATABASE;
  if (!dbName) {
    throw new Error('E2E_D1_DATABASE is unset: the global setup did not run');
  }
  const location = process.env.E2E_D1_REMOTE
    ? ['--remote']
    : ['--local', ...(process.env.E2E_D1_PERSIST_TO ? ['--persist-to', process.env.E2E_D1_PERSIST_TO] : [])];
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', dbName, ...location, '--json', '--command', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out)[0].results;
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function storedPasswordHash(email: string): Promise<string | undefined> {
  const [row] = query(`SELECT password_hash FROM users WHERE email = ${literal(email)}`);
  return Promise.resolve(row?.password_hash as string | undefined);
}

export function setPasswordHash(email: string, passwordHash: string): Promise<void> {
  query(`UPDATE users SET password_hash = ${literal(passwordHash)} WHERE email = ${literal(email)}`);
  return Promise.resolve();
}
