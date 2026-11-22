import { inspect } from 'node:util';
import { afterEach, expect, test, vi } from 'vitest';
import { cloudflareCachePurge } from './mediaStore.ts';

const TOKEN = 'purge-token-canary';
const purge = cloudflareCachePurge({ zoneId: 'zone', token: TOKEN });

afterEach(() => vi.unstubAllGlobals());

/** What a purge throws, with every field and cause it holds. */
async function failure(answer: () => Promise<Response>): Promise<string> {
  vi.stubGlobal('fetch', answer);
  try {
    await purge('https://media.example/file');
  } catch (error) {
    return inspect(error, { depth: 12 });
  }
  throw new Error('The purge did not fail');
}

test('a purge posts the file to its zone with the token', async () => {
  let sent: unknown;
  vi.stubGlobal('fetch', async (request: Request) => {
    sent = [request.method, request.url, request.headers.get('authorization'), await request.json()];
    return Response.json({ success: true });
  });
  await purge('https://media.example/file');
  expect(sent).toStrictEqual([
    'POST',
    'https://api.cloudflare.com/client/v4/zones/zone/purge_cache',
    `Bearer ${TOKEN}`,
    { files: ['https://media.example/file'] },
  ]);
});

test('a refused purge names the status and never holds the token', async () => {
  const thrown = await failure(() => Promise.resolve(Response.json({ success: false }, { status: 403 })));
  expect(thrown).toContain('status 403');
  expect(thrown).not.toContain(TOKEN);
});

test('a purge with no answer says so and never holds the token', async () => {
  const thrown = await failure(() => Promise.reject(new TypeError('fetch failed')));
  expect(thrown).toContain('NetworkError');
  expect(thrown).not.toContain(TOKEN);
});

test('an answer without success fails the purge', async () => {
  const thrown = await failure(() => Promise.resolve(Response.json({ success: false })));
  expect(thrown).toContain('without success');
});
