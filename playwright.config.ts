import { defineConfig, devices } from '@playwright/test';
import webpush from 'web-push';
import { BASE_URL, LOCAL_E2E_DB_NAME, LOCAL_MONGODB_URI, LOCAL_PORT, STARTS_LOCAL_SERVER } from './e2e/support/env.ts';

const CI = !!process.env.CI;

// Throwaway keys for the local server: no Notification ever reaches a real device.
const vapid = STARTS_LOCAL_SERVER ? webpush.generateVAPIDKeys() : null;

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
  webServer: vapid
    ? {
        command: `npm run build && npm run start -- --port ${LOCAL_PORT}`,
        url: `${BASE_URL}/api/version`,
        reuseExistingServer: !CI,
        timeout: 240_000,
        env: {
          MONGODB_URI: LOCAL_MONGODB_URI,
          MONGODB_DB_NAME: LOCAL_E2E_DB_NAME,
          ROOT_DOMAIN: `localhost:${LOCAL_PORT}`,
          SESSION_SECRET: 'local-e2e-session-secret',
          NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
          VAPID_PRIVATE_KEY: vapid.privateKey,
          VAPID_EMAIL: 'mailto:e2e@waitingpages.test',
        },
      }
    : undefined,
});
