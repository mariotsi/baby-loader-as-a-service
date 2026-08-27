export interface GeoLocation {
  city: string | null;
  region: string | null;
  regionCode: string | null;
  country: string | null;
  countryCode: string | null;
  countryCodeIso3: string | null;
  countryCapital: string | null;
  countryTld: string | null;
  continentCode: string | null;
  inEu: boolean | null;
  postal: string | null;
  lat: number | null;
  lon: number | null;
  timezone: string | null;
  utcOffset: string | null;
  callingCode: string | null;
  currency: string | null;
  currencyName: string | null;
  languages: string | null;
  asn: string | null;
  org: string | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — enough to dedupe re-subscribes on a warm instance
const LOOKUP_TIMEOUT_MS = 3000;

// Serverless instances are ephemeral, so this cache is best-effort, not a
// correctness requirement.
const cache = new Map<string, { value: GeoLocation | null; expires: number }>();

function isPrivateOrInvalid(ip: string): boolean {
  if (!ip || ip === 'unknown') {
    return true;
  }
  if (ip === '::1' || ip === '127.0.0.1') {
    return true;
  }
  if (/^10\./.test(ip)) {
    return true;
  }
  if (/^192\.168\./.test(ip)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {
    return true;
  }
  if (/^(fc|fd|fe80)/i.test(ip)) {
    return true;
  }
  return false;
}

function str(value: unknown, max = 150): string | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  return value.length > max ? value.slice(0, max) : value;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * Best-effort city/country lookup from the request IP. Never throws: a
 * network hiccup or rate limit should not prevent someone from subscribing.
 */
export async function lookupGeo(ip: string): Promise<GeoLocation | null> {
  if (isPrivateOrInvalid(ip)) {
    return null;
  }

  const cached = cache.get(ip);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'baby-loader-as-a-service (+push subscription geolocation)' },
    });

    if (!res.ok) {
      cache.set(ip, { value: null, expires: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const data = await res.json();
    if (data?.error) {
      // e.g. rate limited or reserved IP range
      cache.set(ip, { value: null, expires: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const geo: GeoLocation = {
      city: str(data.city, 100),
      region: str(data.region, 100),
      regionCode: str(data.region_code, 10),
      country: str(data.country_name, 100),
      countryCode: str(data.country_code, 5),
      countryCodeIso3: str(data.country_code_iso3, 5),
      countryCapital: str(data.country_capital, 100),
      countryTld: str(data.country_tld, 10),
      continentCode: str(data.continent_code, 5),
      inEu: bool(data.in_eu),
      postal: str(data.postal, 20),
      lat: num(data.latitude),
      lon: num(data.longitude),
      timezone: str(data.timezone, 60),
      utcOffset: str(data.utc_offset, 10),
      callingCode: str(data.country_calling_code, 10),
      currency: str(data.currency, 10),
      currencyName: str(data.currency_name, 50),
      languages: str(data.languages, 100),
      asn: str(data.asn, 20),
      org: str(data.org, 150),
    };

    cache.set(ip, { value: geo, expires: Date.now() + CACHE_TTL_MS });
    return geo;
  } catch (err) {
    console.error('[geoip] lookup failed', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
