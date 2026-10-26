import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` writes a migration for each schema change into
// migrations/, where `wrangler d1 migrations apply` finds it (ADR-0009).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
});
