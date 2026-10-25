import type { Place } from './siteSettings.ts';

/**
 * How a Milestone's Place (see GLOSSARY.md) is made from the Photon search
 * result the Owner picks: the address line and the point both come from
 * that one result, so they always match. Pure, so the editor runs it in the
 * browser.
 */

/** The parts of a Photon result, a GeoJSON Feature, that a Place reads. Photon leaves out every property it has no value for. */
export type PhotonFeature = {
  geometry: { coordinates: [lon: number, lat: number] };
  properties: {
    /** What the result is: `house`, `street`, `city`, `district`, `country` and so on. A POI is a `house`. */
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
};

/**
 * Google Maps' universal URL searching for the Place's address, so Google
 * shows the place by name, with directions. It opens the Google Maps app on
 * phones that have it, the browser otherwise. Google finds the address with
 * its own geocoder, so its pin can stand apart from the point on our map.
 */
export function googleMapsUrl({ address }: Pick<Place, 'address'>): string {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: address })}`;
}

export function placeFromPhoton(feature: PhotonFeature): Place {
  const [lon, lat] = feature.geometry.coordinates;
  return { address: addressLine(feature.properties), lat, lon };
}

/**
 * The POI's name, street and house number, postcode and city, then country,
 * each when Photon has it: `Ospedale Niguarda, Piazza dell'Ospedale
 * Maggiore 3, 20162 Milano, Italia`. A street's, a town's or a country's own
 * result has its name only in `name`: a town's stands in for the city, and
 * a name that repeats a part the line already has is dropped.
 */
export function addressLine(properties: PhotonFeature['properties']): string {
  const { type, name, housenumber, street, postcode, country } = properties;
  const city = properties.city || (type === 'city' ? name : undefined);
  const repeated = !!name && [street, city, country].some((part) => !!part && same(part, name));
  return present(
    [repeated ? undefined : name, present([street, housenumber], ' '), present([postcode, city], ' '), country],
    ', '
  );
}

/** The parts Photon has, joined by `separator`; empty when it has none. */
function present(parts: (string | undefined)[], separator: string): string {
  return parts.filter((part) => !!part).join(separator);
}

function same(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}
