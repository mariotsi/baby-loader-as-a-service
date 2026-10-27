import { readdir, readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import { getDb, newId, setTestDb } from './index.ts';
import * as schema from './schema.ts';

/** Inserts a User with an unusable password hash and returns its id, for tests that need an Owner. */
export async function insertTestUser(): Promise<string> {
  const id = newId();
  await getDb()
    .insert(schema.users)
    .values({ id, email: `${id}@example.com`, passwordHash: 'test', createdAt: new Date().toISOString() });
  return id;
}

const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url);

/**
 * A throwaway in-memory D1 for tests that cross the persistence seam, with
 * every migration in migrations/ applied. Call it before the first query; the
 * returned function disposes of it.
 */
export async function startTestDb(): Promise<() => Promise<void>> {
  const proxy = await getPlatformProxy<{ DB: Parameters<typeof drizzle>[0] }>({
    configPath: new URL('./wrangler.test.jsonc', import.meta.url).pathname,
    persist: false,
    envFiles: [],
  });
  for (const file of (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(file, MIGRATIONS_DIR), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);
    await proxy.env.DB.batch(statements.map((statement) => proxy.env.DB.prepare(statement)));
  }
  setTestDb(drizzle(proxy.env.DB, { schema }));
  process.env.SESSION_SECRET ??= 'test-session-secret';
  return async () => {
    setTestDb(undefined);
    await proxy.dispose();
  };
}
