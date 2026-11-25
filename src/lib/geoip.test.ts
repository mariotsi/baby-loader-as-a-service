import { inspect } from 'node:util';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

/** An address from the range kept for documentation. */
const IP = '203.0.113.77';

let lookupGeo: typeof import('./geoip.ts').lookupGeo;
/** The URLs ipapi was asked. */
let asked: string[];
/** Everything written to the log, with every field an error holds. */
let logged: () => string;

beforeEach(async () => {
  // The cache lives as long as the module, so each test loads its own.
  vi.resetModules();
  ({ lookupGeo } = await import('./geoip.ts'));
  asked = [];
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  logged = () => inspect(error.mock.calls, { depth: 12 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function answering(answer: () => Promise<Response>) {
  vi.stubGlobal('fetch', (request: Request) => {
    asked.push(request.url);
    return answer();
  });
}

const json =
  (body: unknown, status = 200) =>
  () =>
    Promise.resolve(Response.json(body, { status }));

test('an answer is read into the fields a Subscription keeps, and anything of another type is left out', async () => {
  answering(json({ city: 'Turin', country_name: 'Italy', latitude: 45.07, in_eu: true, postal: 10121, asn: '' }));
  expect(await lookupGeo(IP)).toMatchObject({
    city: 'Turin',
    country: 'Italy',
    lat: 45.07,
    inEu: true,
    postal: null,
    asn: null,
  });
  expect(asked).toStrictEqual([`https://ipapi.co/${IP}/json/`]);
});

test('an address with no place on the map is never sent', async () => {
  answering(json({}));
  for (const ip of ['', 'unknown', '::1', '127.0.0.1', '10.0.0.1', '192.168.1.4', '172.16.0.1', 'fd00::1']) {
    expect(await lookupGeo(ip), ip).toBe(null);
  }
  expect(asked).toStrictEqual([]);
});

test('an answer is kept for an hour', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  answering(json({ city: 'Turin' }));
  await lookupGeo(IP);
  vi.setSystemTime(Date.now() + 59 * 60_000);
  expect(await lookupGeo(IP)).toMatchObject({ city: 'Turin' });
  expect(asked).toHaveLength(1);
  vi.setSystemTime(Date.now() + 2 * 60_000);
  await lookupGeo(IP);
  expect(asked).toHaveLength(2);
});

test('a refusal is logged with its status, not retried and not asked again', async () => {
  answering(json({ error: true }, 429));
  expect(await lookupGeo(IP)).toBe(null);
  expect(await lookupGeo(IP)).toBe(null);
  expect(asked).toHaveLength(1);
  expect(logged()).toContain('status 429');
  expect(logged()).not.toContain(IP);
});

test('an error answered with a 200 is logged and not asked again', async () => {
  answering(json({ error: true, ip: IP, reason: 'Reserved IP Address' }));
  expect(await lookupGeo(IP)).toBe(null);
  expect(await lookupGeo(IP)).toBe(null);
  expect(asked).toHaveLength(1);
  expect(logged()).toContain('[geoip] lookup failed');
  expect(logged()).not.toContain(IP);
});

test('no answer is logged without the address, and is asked again', async () => {
  answering(() => Promise.reject(new TypeError('fetch failed')));
  expect(await lookupGeo(IP)).toBe(null);
  expect(await lookupGeo(IP)).toBe(null);
  expect(asked).toHaveLength(2);
  expect(logged()).toContain('NetworkError');
  expect(logged()).not.toContain(IP);
});

test('a lookup that takes over 3 seconds is logged without the address', async () => {
  answering(() => new Promise<Response>(() => undefined));
  expect(await lookupGeo(IP)).toBe(null);
  expect(logged()).toContain('TimeoutError');
  expect(logged()).not.toContain(IP);
});

test('an answer that is not JSON is logged without quoting it', async () => {
  answering(() => Promise.resolve(new Response(`<${IP}>`)));
  expect(await lookupGeo(IP)).toBe(null);
  expect(logged()).toContain('SyntaxError');
  expect(logged()).not.toContain(IP);
});
