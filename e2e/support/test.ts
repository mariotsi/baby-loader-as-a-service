import { createECDH, randomBytes } from 'node:crypto';
import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  test as base,
  expect,
  type Page,
} from '@playwright/test';
import { fixtureSite, type Owner, type ProjectName } from './data.ts';
import { BASE_URL, bypassHeaders, ownerStatePath } from './env.ts';

export { expect };

/**
 * Adds the Access service token headers to requests for the deployment under
 * test only: its root host and the Sites on its subdomains.
 */
export async function withBypass(context: BrowserContext): Promise<BrowserContext> {
  const headers = bypassHeaders();
  if (Object.keys(headers).length > 0) {
    const { protocol, host } = new URL(BASE_URL);
    await context.route(
      (url) => url.protocol === protocol && (url.host === host || url.host.endsWith(`.${host}`)),
      (route) => route.continue({ headers: { ...route.request().headers(), ...headers } })
    );
  }
  return context;
}

export async function newContext(browser: Browser, options: BrowserContextOptions = {}): Promise<BrowserContext> {
  return withBypass(await browser.newContext({ baseURL: BASE_URL, ...options }));
}

const addressCache = new Map<string, string>();

/**
 * A Site's Address as its Owner's Dashboard links it: `/sites/<slug>` on a
 * preview deployment, `<slug>.<root domain>` elsewhere. Tests reach Public
 * pages through it, never by building the URL themselves. It reads every
 * link's href, so it finds the Address whichever language the Dashboard is in.
 */
export async function dashboardAddress(page: Page, slug: string): Promise<string> {
  await page.goto('/dashboard');
  const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
  const pattern = new RegExp(`(//|/sites/)${slug}(\\.|/|$)`);
  const address = hrefs.find((href) => pattern.test(href));
  if (!address) {
    throw new Error(`The Dashboard links no Site "${slug}"`);
  }
  return address;
}

type Fixtures = {
  project: ProjectName;
  /** Address of a fixture Site, read from its Owner's Dashboard. */
  addressOf: (slug: string) => Promise<string>;
  /** A page logged in as a fixture Owner. */
  ownerPage: (owner: Owner) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  context: async ({ context }, use) => {
    await use(await withBypass(context));
  },

  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's dependencies from this destructuring.
  project: async ({}, use, testInfo) => {
    await use(testInfo.project.name as ProjectName);
  },

  ownerPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (owner) => {
      const context = await newContext(browser, { storageState: ownerStatePath(owner) });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },

  addressOf: async ({ browser }, use) => {
    await use(async (slug) => {
      const cached = addressCache.get(slug);
      if (cached) {
        return cached;
      }
      const context = await newContext(browser, { storageState: ownerStatePath(fixtureSite(slug).owner) });
      try {
        const address = await dashboardAddress(await context.newPage(), slug);
        addressCache.set(slug, address);
        return address;
      } finally {
        await context.close();
      }
    });
  },
});

/**
 * Stands in for the browser's push service: Playwright's browsers cannot
 * reach Google's or Apple's, and WebKit has none. The page gets a granted
 * permission and a subscription to an endpoint that never resolves, so
 * everything up to the delivery itself runs for real: the Subscription is
 * stored, and sending a Notification attempts it.
 */
export async function fakePushService(page: Page): Promise<void> {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const subscription = {
    endpoint: `https://push.invalid/e2e/${randomBytes(8).toString('hex')}`,
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
  await page.addInitScript(({ endpoint, p256dh, auth }) => {
    let current: object | null = null;
    const sub = {
      endpoint,
      toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh, auth } }),
      unsubscribe: () => {
        current = null;
        return Promise.resolve(true);
      },
    };
    const registration = {
      pushManager: {
        subscribe: async () => (current = sub),
        getSubscription: async () => current,
      },
    };
    const serviceWorker = {
      register: async () => registration,
      getRegistration: async () => registration,
      ready: Promise.resolve(registration),
    };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    // biome-ignore lint/correctness/noComponentHookFactories: a stand-in for the browser's Notification constructor, not a React component.
    const FakeNotification = function Notification() {} as unknown as {
      permission: string;
      requestPermission: () => Promise<string>;
    };
    FakeNotification.permission = 'granted';
    FakeNotification.requestPermission = async () => 'granted';
    Object.defineProperty(window, 'Notification', { configurable: true, value: FakeNotification });
  }, subscription);
}
