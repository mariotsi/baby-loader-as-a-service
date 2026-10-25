'use client';

import type { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { MilestoneItem } from '@/lib/publicPageView';
import styles from './MilestonePlace.module.css';

/** OpenFreeMap's styles (https://openfreemap.org): free, no key, commercial use allowed. */
const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const ZOOM = 14;
/** How far below the fold a map starts loading, so it is drawn by the time it scrolls in. */
const PRELOAD_MARGIN = '200px';

type Place = NonNullable<MilestoneItem['place']>;

/**
 * A Milestone's Place: a small map centered on it, and its address, both
 * one link to Google Maps. When the map cannot be drawn, without WebGL or
 * when its tiles fail, only the address shows.
 */
export function MilestonePlace({ place }: { place: Place }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.place}>
      <a
        href={place.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={place.linkLabel}
        className={styles.link}
      >
        {failed ? null : <PlaceMap lat={place.lat} lon={place.lon} onFail={() => setFailed(true)} />}
        <span className={styles.address}>
          <Icon name="map-pin" className={styles.addressIcon} />
          <span className={styles.addressText}>{place.address}</span>
        </span>
      </a>
      {failed ? null : (
        // Outside the link, so its own links work, and outside the fade, so it stays readable.
        <p className={styles.attribution}>
          ©{' '}
          <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">
            OpenFreeMap
          </a>{' '}
          ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>
        </p>
      )}
    </div>
  );
}

/**
 * MapLibre downloads only once a map nears the viewport, and each map is
 * destroyed when it leaves it: browsers cap the live WebGL contexts, and a
 * page can hold 50 Milestones. The map never takes input; the center is
 * always the Place, so the pin is drawn over it by CSS.
 */
function PlaceMap({ lat, lon, onFail }: { lat: number; lon: number; onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dark, setDark] = useState(false);
  const fail = useEffectEvent(onFail);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: PRELOAD_MARGIN,
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) {
      return;
    }
    let map: MapLibreMap | undefined;
    let cancelled = false;
    import('maplibre-gl')
      .then((maplibre) => {
        if (cancelled) {
          return;
        }
        // MapLibre derives its worker's URL at run time, where the bundler cannot see it: the literal URL here
        // makes the bundler ship the worker, and tells MapLibre where it went.
        maplibre.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);
        const isDark = getComputedStyle(canvas).getPropertyValue('--color-scheme').trim() === 'dark';
        setDark(isDark);
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        // Throws when the browser has no WebGL.
        map = new maplibre.Map({
          container: canvas,
          style: isDark ? MAP_STYLES.dark : MAP_STYLES.light,
          center: [lon, lat],
          zoom: ZOOM,
          interactive: false,
          attributionControl: false,
          fadeDuration: reducedMotion ? 0 : undefined,
          // OpenFreeMap's styles carry filters this MapLibre warns about but draws fine.
          validateStyle: false,
        });
        map.on('error', (event) => {
          console.error('Map failed', event.error);
          fail();
        });
      })
      .catch((error) => {
        console.error('Map failed', error);
        fail();
      });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [visible, lat, lon]);

  return (
    <div ref={containerRef} className={styles.map} aria-hidden="true">
      <div ref={canvasRef} className={[styles.canvas, dark && styles.dark].filter(Boolean).join(' ')} />
      <Icon name="map-pin" className={styles.pin} />
    </div>
  );
}
