import { getCloudflareContext } from '@opennextjs/cloudflare';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.ts';

export type Database = DrizzleD1Database<typeof schema>;

let testDb: Database | undefined;

/**
 * This deployment's D1 database, through the Worker's `DB` binding: each
 * environment binds its own (wrangler.jsonc, wrangler.production.jsonc), and
 * `next dev` gets a local one (next.config.ts). A binding opens no
 * connection, so every call can take it afresh.
 */
export function getDb(): Database {
  if (testDb) {
    return testDb;
  }
  return drizzle(getCloudflareContext().env.DB, { schema });
}

/** Points getDb at a test database (src/db/testDb.ts); undefined goes back to the binding. */
export function setTestDb(db: Database | undefined): void {
  testDb = db;
}

/** A new row id: a random UUID, which can't be guessed from another one (ids travel in session cookies and URLs). */
export function newId(): string {
  return crypto.randomUUID();
}

/** Whether `id` has the shape newId produces; anything else matches no row. */
export function isId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
}

/** True for D1's error on a UNIQUE constraint, optionally on one column (`table.column`). */
export function isUniqueViolation(err: unknown, column?: string): boolean {
  const message = String(err instanceof Error ? (err.cause ?? err) : err);
  return message.includes('UNIQUE constraint failed') && (!column || message.includes(column));
}
