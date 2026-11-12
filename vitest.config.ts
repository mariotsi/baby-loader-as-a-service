import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every test in the repo runs under Vitest, in one of three projects
 * (docs/adr/0011-one-test-runner-vitest.md):
 *
 * - `unit`: every `*.test.ts` under `src` and every `*.test.mjs` under
 *   `scripts`, in Node. Some of them cross the persistence seam on an
 *   in-memory D1 (src/db/testDb.ts), which wrangler serves from a workerd
 *   process and so needs Node. Each test file runs in its own worker with its
 *   own module graph, so a file that calls `startTestDb` gets a database no
 *   other file sees and the files run in parallel; the tests inside a file run
 *   in order and share that database. The timeouts leave room for workerd to
 *   start and the migrations to apply on a loaded machine.
 * - `components`: every `*.test.tsx` under `src`, in jsdom with React Testing
 *   Library (`render`, `renderHook`), for a component's or a hook's behaviour.
 * - `storybook`: every story rendered in Chromium with axe run on it, so an
 *   accessibility violation in any component, state or Palette fails.
 *
 * `npm test` runs `unit` and `components`; `npm run test:storybook` runs
 * `storybook`, the only project that needs a browser.
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
        resolve: { alias: { '@': path.join(dirname, 'src') } },
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./vitest.components.setup.ts'],
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
