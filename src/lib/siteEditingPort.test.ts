import { afterEach, expect, test, vi } from 'vitest';
import { fetchSiteEditingPort } from './siteEditingPort.ts';
import { settingsPath } from './siteSettings.ts';

afterEach(() => vi.unstubAllGlobals());

/** Answers the next `fetch` with `answer`, and records what was asked. */
function answering(answer: Response | Error) {
  const asked: { url: string; method?: string; body?: unknown }[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    asked.push({
      url,
      method: init?.method,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    });
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  });
  return asked;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const port = fetchSiteEditingPort('emma');
const settingsBody = { updatedAt: 'then', settings: {} } as Parameters<typeof port.saveSettings>[0];
const mp4 = new File(['x'], 'hello.mp4', { type: 'video/mp4' });

test('each save asks its own route, and answers the saved Site with how the Birth notification went', async () => {
  const site = { slug: 'emma' };
  let asked = answering(json({ site, notification: null }));
  expect(await port.saveSettings(settingsBody)).toStrictEqual({ ok: true, site, notification: null });
  expect(asked).toStrictEqual([{ url: '/api/sites/emma', method: 'PUT', body: settingsBody }]);

  asked = answering(json({ site, notification: { sent: 2, removed: 0, total: 2 } }));
  const birth = { updatedAt: 'then' } as Parameters<typeof port.setBirth>[0];
  expect(await port.setBirth(birth)).toStrictEqual({
    ok: true,
    site,
    notification: { sent: 2, removed: 0, total: 2 },
  });
  expect(asked[0]).toStrictEqual({ url: '/api/sites/emma/birth', method: 'PUT', body: birth });

  asked = answering(json({ site, notification: null }));
  await port.clearBirth({ updatedAt: 'then' });
  expect(asked[0]).toStrictEqual({ url: '/api/sites/emma/birth', method: 'DELETE', body: { updatedAt: 'then' } });
});

test('Site settings errors come back as errors, and a 409 as a stale refusal', async () => {
  const errors = [{ path: settingsPath('timezone'), code: 'invalidOption' }];
  answering(json({ errors }, 400));
  expect(await port.saveSettings(settingsBody)).toStrictEqual({ ok: false, errors });
  answering(json({ error: { code: 'staleSite' } }, 409));
  expect(await port.saveSettings(settingsBody)).toStrictEqual({
    ok: false,
    refused: { code: 'staleSite' },
    stale: true,
  });
  answering(json({ error: { code: 'notAuthenticated' } }, 401));
  expect(await port.saveSettings(settingsBody)).toStrictEqual({
    ok: false,
    refused: { code: 'notAuthenticated' },
    stale: false,
  });
});

test('no answer, or one that is not JSON, is a refusal with no error and never throws', async () => {
  const nothing = { ok: false, refused: undefined, stale: false };
  answering(new TypeError('Failed to fetch'));
  expect(await port.saveSettings(settingsBody)).toStrictEqual(nothing);
  answering(new Response('<html>Request Entity Too Large</html>', { status: 413 }));
  expect(await port.setBirth({ updatedAt: 'then' } as Parameters<typeof port.setBirth>[0])).toStrictEqual(nothing);
  answering(new Response('<html>ok</html>', { status: 200 }));
  expect(await port.clearBirth({ updatedAt: 'then' })).toStrictEqual(nothing);
});

test('an upload answers the media with the file’s name, type and size', async () => {
  const asked = answering(json({ media: { key: 'k', url: 'https://media.example/k' } }, 201));
  expect(await port.upload(mp4)).toStrictEqual({
    ok: true,
    media: { key: 'k', url: 'https://media.example/k', name: 'hello.mp4', type: 'video/mp4', size: 1 },
  });
  expect([asked[0].url, asked[0].method]).toStrictEqual(['/api/sites/emma/media', 'POST']);
  expect((asked[0].body as FormData).get('file')).toBeInstanceOf(File);
});

test('a failed upload is a refusal the route worded, or one with no error, and never throws', async () => {
  answering(json({ error: { code: 'mediaTooLarge' } }, 413));
  expect(await port.upload(mp4)).toStrictEqual({ ok: false, refused: { code: 'mediaTooLarge' } });
  answering(new TypeError('Failed to fetch'));
  expect(await port.upload(mp4)).toStrictEqual({ ok: false, refused: undefined });
  answering(new Response('<html>Request Entity Too Large</html>', { status: 413 }));
  expect(await port.upload(mp4)).toStrictEqual({ ok: false, refused: undefined });
  answering(json({}, 201));
  expect(await port.upload(mp4)).toStrictEqual({ ok: false, refused: undefined });
});
