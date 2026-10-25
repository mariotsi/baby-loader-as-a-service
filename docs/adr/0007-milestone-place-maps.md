# Milestone Places come from Photon and are drawn with MapLibre on OpenFreeMap

A Milestone's Place is searched with [Photon](https://photon.komoot.io), an OpenStreetMap geocoder whose fair use allows search as you type from the browser; [Nominatim](https://operations.osmfoundation.org/policies/nominatim/), the better-known OSM geocoder, forbids client-side autocomplete. The Public page draws each Place on a small map with [MapLibre GL JS](https://maplibre.org/) and [OpenFreeMap](https://openfreemap.org/) tiles: free, with no API key and commercial use allowed. A paid provider such as Google Maps or Mapbox would bring a key to guard, billing per map load, and terms on where its maps may be shown, for a map that only has to say where a Milestone happened.

## Consequences

- The Owner's browser sends what they type in a Place field to Photon, which runs the search; the server never calls Photon.
- A Visitor's browser fetches the map's style and tiles from OpenFreeMap, which thereby learns their IP address and that they opened a page showing that area. Only pages with a Place in view do: MapLibre loads, and a map is drawn, only as one scrolls into view.
- Clicking a Place sends the Visitor to Google Maps, searching for its address.
- Neither service promises uptime. When Photon fails, the Owner can still save a Milestone without a Place; when the map fails, the Public page shows the address alone.
- Moving to another geocoder or tile provider touches the Place field and the map only: a Place is stored as its address and point, with nothing tied to Photon.
