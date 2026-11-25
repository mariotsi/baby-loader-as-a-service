import { expect, test } from 'vitest';
import { geoFromCf } from './geoip.ts';

/** A request from Turin, as Cloudflare describes it. */
const turin = {
  city: 'Turin',
  region: 'Piedmont',
  regionCode: '21',
  country: 'IT',
  continent: 'EU',
  isEUCountry: '1',
  postalCode: '10121',
  latitude: '45.07049',
  longitude: '7.68682',
  timezone: 'Europe/Rome',
  asn: 3269,
  asOrganization: 'Telecom Italia',
  colo: 'MXP',
  tlsVersion: 'TLSv1.3',
};

test('the request’s cf properties are read into what a Subscription keeps', () => {
  expect(geoFromCf(turin)).toStrictEqual({
    city: 'Turin',
    region: 'Piedmont',
    regionCode: '21',
    country: 'Italy',
    countryCode: 'IT',
    continentCode: 'EU',
    inEu: true,
    postal: '10121',
    lat: 45.07049,
    lon: 7.68682,
    timezone: 'Europe/Rome',
    asn: 'AS3269',
    org: 'Telecom Italia',
  });
});

test('a country outside the EU says so, and one Cloudflare cannot place has no name', () => {
  expect(geoFromCf({ country: 'CH' })).toMatchObject({ country: 'Switzerland', countryCode: 'CH', inEu: false });
  expect(geoFromCf({ country: 'T1' })).toMatchObject({ country: null, countryCode: 'T1' });
});

test('what Cloudflare leaves out, or sends as something else, is null', () => {
  expect(geoFromCf({ city: 'Turin', latitude: 'north', longitude: 200, asn: '3269', postalCode: 10121 })).toStrictEqual(
    {
      city: 'Turin',
      region: null,
      regionCode: null,
      country: null,
      countryCode: null,
      continentCode: null,
      inEu: null,
      postal: null,
      lat: null,
      lon: null,
      timezone: null,
      asn: null,
      org: null,
    }
  );
});

test('a request Cloudflare did not place has no location', () => {
  expect(geoFromCf(undefined)).toBe(null);
  expect(geoFromCf(null)).toBe(null);
  expect(geoFromCf('cf')).toBe(null);
  expect(geoFromCf({ colo: 'MXP', tlsVersion: 'TLSv1.3' })).toBe(null);
});
