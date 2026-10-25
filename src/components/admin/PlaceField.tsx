'use client';

import { useEffect, useState } from 'react';
import { Combobox } from '@/components/ui/Combobox';
import { Field } from '@/components/ui/Field';
import { type PhotonFeature, placeFromPhoton } from '@/lib/place';
import type { Place } from '@/lib/siteSettings';

/**
 * Photon (https://photon.komoot.io), an OpenStreetMap geocoder that allows
 * search as you type from the browser. No `lang`, so names come in their
 * local language.
 */
const PHOTON_URL = 'https://photon.komoot.io/api/';
const MIN_LETTERS = 3;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 5;

type Search = { state: 'idle' } | { state: 'searching' } | { state: 'done'; places: Place[] } | { state: 'failed' };

/**
 * Searches Photon for `query` once the Owner stops typing for a moment,
 * cancelling the search before it. An empty query, as while a picked Place
 * fills the field, searches nothing.
 */
function usePlaceSearch(query: string): Search {
  const [search, setSearch] = useState<Search>({ state: 'idle' });
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_LETTERS) {
      setSearch({ state: 'idle' });
      return;
    }
    setSearch({ state: 'searching' });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `${PHOTON_URL}?${new URLSearchParams({ q, limit: String(MAX_RESULTS) })}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Photon answered ${res.status}`);
        }
        const { features } = (await res.json()) as { features: PhotonFeature[] };
        setSearch({ state: 'done', places: distinct(features.map(placeFromPhoton)) });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Place search failed', error);
          setSearch({ state: 'failed' });
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return search;
}

/** One suggestion per address line: Photon can return a building and the POI inside it, which read the same. */
function distinct(places: Place[]): Place[] {
  return places.filter((place, i) => places.findIndex((other) => other.address === place.address) === i);
}

function statusText(search: Search): string | undefined {
  switch (search.state) {
    case 'done':
      if (search.places.length === 0) {
        return 'No places match. Try a street, a town or a hospital.';
      }
      return search.places.length === 1 ? '1 place found' : `${search.places.length} places found`;
    case 'failed':
      return 'Search is unavailable right now. Clear the field to save without a place.';
    default:
      return undefined;
  }
}

interface PlaceFieldProps {
  /** What the field shows: the picked Place's address, or what the Owner is typing. */
  text: string;
  /** The picked Place, until the Owner types over it or clears it. */
  place: Place | undefined;
  onChange: (text: string, place: Place | undefined) => void;
  error?: string;
  className?: string;
}

/**
 * A Milestone's Place: the Owner searches for an address and picks one, so
 * the address and the point always come from the same result. Typing over a
 * picked Place drops it until another is picked.
 */
export function PlaceField({ text, place, onChange, error, className }: PlaceFieldProps) {
  const search = usePlaceSearch(place ? '' : text);
  return (
    <Field
      label="Place"
      optional
      hint="Everyone who opens your page sees this place on a map."
      error={error}
      className={className}
    >
      <Combobox
        value={text}
        onValueChange={(typed) => onChange(typed, undefined)}
        options={search.state === 'done' ? search.places : []}
        getOptionKey={(option) => option.address}
        renderOption={(option) => option.address}
        onSelect={(picked) => onChange(picked.address, picked)}
        loading={search.state === 'searching'}
        status={statusText(search)}
        listLabel="Places"
        clear={{ label: 'Remove the place', onClear: () => onChange('', undefined) }}
        placeholder="Search for an address"
      />
    </Field>
  );
}
