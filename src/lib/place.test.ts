import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressLine, type PhotonFeature, placeFromPhoton } from './place.ts';

test('a Place takes the address line and the point of the same result, GeoJSON order turned round', () => {
  const feature: PhotonFeature = {
    geometry: { coordinates: [9.1926, 45.5106] },
    properties: {
      type: 'house',
      housenumber: '12',
      street: 'Via Roma',
      postcode: '20121',
      city: 'Milano',
      country: 'Italia',
    },
  };
  assert.deepEqual(placeFromPhoton(feature), {
    address: 'Via Roma 12, 20121 Milano, Italia',
    lat: 45.5106,
    lon: 9.1926,
  });
});

test("a POI's name leads its street address", () => {
  assert.equal(
    addressLine({
      type: 'house',
      name: 'Ospedale Niguarda',
      housenumber: '3',
      street: "Piazza dell'Ospedale Maggiore",
      postcode: '20162',
      city: 'Milano',
      country: 'Italia',
    }),
    "Ospedale Niguarda, Piazza dell'Ospedale Maggiore 3, 20162 Milano, Italia"
  );
});

test("a street's own result leads with its name", () => {
  assert.equal(
    addressLine({ type: 'street', name: 'Via Roma', postcode: '20121', city: 'Milano', country: 'Italia' }),
    'Via Roma, 20121 Milano, Italia'
  );
});

test("a town's name stands in for the city, and a country's is said once", () => {
  assert.equal(addressLine({ type: 'city', name: 'Roma', postcode: '00118', country: 'Italia' }), '00118 Roma, Italia');
  assert.equal(addressLine({ type: 'country', name: 'Italia', country: 'Italia' }), 'Italia');
});

test('a name that repeats the street or the city is dropped, whatever its case', () => {
  assert.equal(
    addressLine({ type: 'house', name: 'via roma', street: 'Via Roma', housenumber: '1', city: 'Milano' }),
    'Via Roma 1, Milano'
  );
  assert.equal(addressLine({ type: 'district', name: 'Milano', city: 'Milano', country: 'Italia' }), 'Milano, Italia');
});

test('parts Photon leaves out, or sends empty, leave no gap', () => {
  assert.equal(addressLine({ type: 'house', street: 'Via Roma', city: 'Milano' }), 'Via Roma, Milano');
  assert.equal(addressLine({ type: 'house', name: '', housenumber: '7', postcode: '20121' }), '7, 20121');
});
