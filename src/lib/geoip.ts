import * as z from 'zod/mini';

/**
 * Where a Subscription was made, as Cloudflare places the Visitor's IP:
 * the `cf` properties of the request that subscribed. Cloudflare sets them on
 * every request to the Worker, so the IP is never sent anywhere to be looked
 * up. A field Cloudflare could not place is null.
 */
export interface GeoLocation {
  city: string | null;
  region: string | null;
  regionCode: string | null;
  /** The country's English name, from its code. */
  country: string | null;
  /** ISO 3166-1 alpha-2. */
  countryCode: string | null;
  continentCode: string | null;
  inEu: boolean | null;
  postal: string | null;
  lat: number | null;
  lon: number | null;
  /** IANA name. */
  timezone: string | null;
  /** The network's autonomous system, as `AS13335`. */
  asn: string | null;
  /** The organization that runs that network. */
  org: string | null;
}

/** The `cf` properties read here. Cloudflare sends the coordinates as strings. */
const cfSchema = z.looseObject({
  city: z.optional(z.unknown()),
  region: z.optional(z.unknown()),
  regionCode: z.optional(z.unknown()),
  country: z.optional(z.unknown()),
  continent: z.optional(z.unknown()),
  isEUCountry: z.optional(z.unknown()),
  postalCode: z.optional(z.unknown()),
  latitude: z.optional(z.unknown()),
  longitude: z.optional(z.unknown()),
  timezone: z.optional(z.unknown()),
  asn: z.optional(z.unknown()),
  asOrganization: z.optional(z.unknown()),
});

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

function str(value: unknown, max = 150): string | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  return value.length > max ? value.slice(0, max) : value;
}

/** A coordinate, sent as a string or a number, within `limit` degrees of zero. */
function coordinate(value: unknown, limit: number): number | null {
  const n = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** The English name of a two-letter country code; null for Cloudflare's codes that name no country, such as `T1` for Tor. */
function countryName(code: string | null): string | null {
  if (!code || !/^[A-Z]{2}$/.test(code)) {
    return null;
  }
  const name = countryNames.of(code);
  return name && name !== code ? name : null;
}

/** Where `cf` places the request, or null when there is no `cf` or it places nothing, as under `next dev`. */
export function geoFromCf(cf: unknown): GeoLocation | null {
  const parsed = cfSchema.safeParse(cf);
  if (!parsed.success) {
    return null;
  }
  const p = parsed.data;
  const countryCode = str(p.country, 2);
  const geo: GeoLocation = {
    city: str(p.city, 100),
    region: str(p.region, 100),
    regionCode: str(p.regionCode, 10),
    country: countryName(countryCode),
    countryCode,
    continentCode: str(p.continent, 5),
    // Cloudflare sets `isEUCountry` only for a country in the EU.
    inEu: countryCode ? p.isEUCountry === '1' : null,
    postal: str(p.postalCode, 20),
    lat: coordinate(p.latitude, 90),
    lon: coordinate(p.longitude, 180),
    timezone: str(p.timezone, 60),
    asn: typeof p.asn === 'number' && Number.isInteger(p.asn) ? `AS${p.asn}` : null,
    org: str(p.asOrganization, 150),
  };
  return Object.values(geo).some((value) => value !== null) ? geo : null;
}
