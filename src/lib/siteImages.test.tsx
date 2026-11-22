import { inspect } from 'node:util';
import { afterEach, expect, test, vi } from 'vitest';
import { shareImage } from './siteImages';
import { defaultSiteSettings, emojiSchema } from './siteSettings';

/** The options each image was drawn with. */
const drawn = vi.hoisted(() => [] as { fonts: unknown[] }[]);

vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(_element: unknown, options: { fonts: unknown[] }) {
      drawn.push(options);
    }
  },
}));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => Promise.reject(new Error('no Worker')) }));

afterEach(() => {
  drawn.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Draws the share image of a Site whose baby is named Zelda, and answers what was logged. */
async function draw(answer: () => Promise<Response>): Promise<string> {
  vi.stubGlobal('fetch', answer);
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const settings = { ...defaultSiteSettings, babyName: 'Zelda', icon: emojiSchema.parse('🐣') };
  await shareImage(settings, 'zelda.loading.baby', 'en', new Date('2026-11-22T12:00:00Z'), {});
  return inspect(error.mock.calls, { depth: 12 });
}

test('a font Google refuses is logged without the text it was asked for, and the image is still drawn', async () => {
  const logged = await draw(() => Promise.resolve(new Response('no', { status: 400 })));
  expect(drawn).toHaveLength(1);
  expect(drawn[0].fonts).toStrictEqual([]);
  expect(logged).toContain('status 400');
  expect(logged.toLowerCase()).not.toContain('zelda');
});

test('a stylesheet with no TrueType file in it is logged', async () => {
  const logged = await draw(() => Promise.resolve(new Response('@font-face {}')));
  expect(drawn[0].fonts).toStrictEqual([]);
  expect(logged).toContain('no TrueType file');
});
