/**
 * Runs once when a server starts, before it serves a request: a missing or
 * malformed environment variable stops it there, named, rather than failing
 * a request later. `next build` does not call it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env');
    validateEnv(process.env);
  }
}
