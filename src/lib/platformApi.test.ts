import { afterEach, expect, test, vi } from 'vitest';
import { platformApi, refusalOf, refusedStatus } from './platformApi.ts';

/** The requests the Platform's routes received, as `[method, url, body]`. */
let received: [string, string, string][];

function answer(response: () => Promise<Response>) {
  received = [];
  vi.stubGlobal('fetch', async (request: Request) => {
    received.push([request.method, request.url, await request.clone().text()]);
    return response();
  });
}

afterEach(() => vi.unstubAllGlobals());

/** What a call threw, for `refusalOf` and `refusedStatus` to read. */
async function thrown(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (error) {
    return error;
  }
  throw new Error('The call did not fail');
}

test('a call reaches the route under /api with its JSON body, once', async () => {
  answer(() => Promise.resolve(Response.json({ site: { slug: 'emma' } })));
  const platform = platformApi.extend({ baseUrl: 'https://loading.baby' });
  expect(await platform.post('sites', { json: { slug: 'emma' } }).json()).toStrictEqual({ site: { slug: 'emma' } });
  expect(received).toStrictEqual([['POST', 'https://loading.baby/api/sites', '{"slug":"emma"}']]);
});

test('a refusal throws, and its body and status read back', async () => {
  answer(() => Promise.resolve(Response.json({ error: { code: 'staleSite' } }, { status: 409 })));
  const platform = platformApi.extend({ baseUrl: 'https://loading.baby' });
  const error = await thrown(() => platform.put('sites/emma', { json: {} }));
  expect(refusalOf(error)).toStrictEqual({ error: { code: 'staleSite' } });
  expect(refusedStatus(error)).toBe(409);
  // A PUT that failed is not sent again: a second attempt would find the Site changed by the first.
  expect(received).toHaveLength(1);
});

test('no answer, an answer that is not JSON, and a body that does not parse are refusals with nothing to read', async () => {
  const platform = platformApi.extend({ baseUrl: 'https://loading.baby' });
  answer(() => Promise.reject(new TypeError('Failed to fetch')));
  const offline = await thrown(() => platform.get('subscribe').json());
  expect([refusalOf(offline), refusedStatus(offline)]).toStrictEqual([null, null]);
  expect(received).toHaveLength(1);

  answer(() => Promise.resolve(new Response('<html>', { status: 502, headers: { 'content-type': 'text/html' } })));
  const proxy = await thrown(() => platform.get('subscribe').json());
  expect([refusalOf(proxy), refusedStatus(proxy)]).toStrictEqual([null, 502]);

  answer(() => Promise.resolve(new Response('not json')));
  const garbled = await thrown(() => platform.get('subscribe').json());
  expect([refusalOf(garbled), refusedStatus(garbled)]).toStrictEqual([null, null]);
});
