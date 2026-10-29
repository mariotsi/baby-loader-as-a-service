import { mkdirSync, writeFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import webpush from 'web-push';
import {
  BASE_URL,
  LOCAL_D1_PERSIST_TO,
  LOCAL_PORT,
  LOCAL_SESSION_SECRET,
  STARTS_LOCAL_SERVER,
} from './e2e/support/env.ts';

const CI = !!process.env.CI;

// Throwaway keys for the local server: no Notification ever reaches a real device.
const vapid = STARTS_LOCAL_SERVER ? webpush.generateVAPIDKeys() : null;

/** The local Worker's variables, in place of .dev.vars, so a developer's own never leak into a run. */
const LOCAL_VARS_FILE = `${LOCAL_D1_PERSIST_TO}.vars`;
if (vapid) {
  mkdirSync(LOCAL_D1_PERSIST_TO, { recursive: true });
  writeFileSync(
    LOCAL_VARS_FILE,
    [
      `ROOT_DOMAIN=localhost:${LOCAL_PORT}`,
      // wrangler.jsonc says staging; this server is a local one, whose fixtures stay local.
      'APP_ENV=development',
      `SESSION_SECRET=${LOCAL_SESSION_SECRET}`,
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapid.publicKey}`,
      `VAPID_PRIVATE_KEY=${vapid.privateKey}`,
      'VAPID_EMAIL=mailto:e2e@waitingpages.test',
      'NEXTJS_ENV=production',
      'MEDIA_STORAGE_ENDPOINT=https://storage.invalid',
      'MEDIA_STORAGE_BUCKET=e2e-media',
      'MEDIA_STORAGE_ACCESS_KEY_ID=e2e-key',
      'MEDIA_STORAGE_SECRET_ACCESS_KEY=e2e-secret',
      'MEDIA_PUBLIC_URL=https://media.invalid',
      'MEDIA_CACHE_PURGE_TOKEN=e2e-token',
      'MEDIA_CACHE_PURGE_ZONE_ID=00000000000000000000000000000000',
    ].join('\n')
  );
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    {
      name: 'iphone',
      use: { ...devices['iPhone 15'] },
      dependencies: ['setup'],
      // Desktop alone runs these. Login and signup allow 10 attempts a minute
      // per IP, so a second browser could trip the limit; Owner isolation is
      // enforced on the server, where the browser makes no difference.
      testIgnore: ['accounts.spec.ts', 'owner-isolation.spec.ts'],
    },
  ],
  // The Worker build under wrangler dev, the runtime staging and production
  // run, with its own local D1 apart from the one `npm run dev` uses.
  webServer: vapid
    ? {
        command: `npm run cf:build && npx wrangler dev --port ${LOCAL_PORT} --persist-to ${LOCAL_D1_PERSIST_TO} --env-file ${LOCAL_VARS_FILE} --infer-origin-from-routes=false`,
        url: `${BASE_URL}/api/version`,
        reuseExistingServer: !CI,
        timeout: 300_000,
        // next build inlines the public key into the browser bundle.
        env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey },
      }
    : undefined,
});
