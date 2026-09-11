import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLng } from '../api/types';

export type MarkerKind = 'pickup' | 'dropoff' | 'driver' | 'driver-available' | 'driver-busy' | 'driver-offline' | 'draft';

export interface MapMarker {
  id: string;
  position: LatLng;
  kind: MarkerKind;
  label?: string;
  /** Pulsing halo — used for a driver whose position is streaming live. */
  live?: boolean;
  onClick?: () => void;
}

export interface MapLine {
  id: string;
  points: LatLng[];
  kind: 'planned' | 'approach' | 'travelled';
}

interface MapViewProps {
  markers: MapMarker[];
  lines?: MapLine[];
  /** When this string changes, the view re-fits to all markers and lines. */
  fitKey?: string;
  onMapClick?: (position: LatLng) => void;
  interactive?: boolean;
  initialCenter?: LatLng;
  initialZoom?: number;
  className?: string;
  ariaLabel?: string;
}

const DEFAULT_CENTER: LatLng = { lat: -6.2, lng: 106.83 };

function markerHtml(marker: MapMarker): string {
  const label = marker.kind === 'pickup' ? 'P' : marker.kind === 'dropoff' ? 'D' : '';
  return `<span class="wp-pin wp-pin--${marker.kind}${marker.live ? ' is-live' : ''}">${label}</span>`;
}

function iconFor(marker: MapMarker): L.DivIcon {
  const driverLike = marker.kind.startsWith('driver');
  const size = driverLike ? 22 : 26;
  return L.divIcon({
    // Drivers glide between updates (CSS transition on transform); fixed points don't.
    className: driverLike ? 'wp-marker wp-marker--moving' : 'wp-marker',
    html: markerHtml(marker),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2, 0],
  });
}

const LINE_STYLE: Record<MapLine['kind'], L.PolylineOptions> = {
  planned: { color: '#1E2A38', weight: 2, opacity: 0.55, dashArray: '2 7', lineCap: 'round' },
  approach: { color: '#2450D8', weight: 3, opacity: 0.8, dashArray: '8 8', lineCap: 'round' },
  travelled: { color: '#2450D8', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' },
};

/** Thin declarative wrapper over Leaflet: markers and lines are diffed by id so moving drivers animate. */
export function MapView({
  markers,
  lines = [],
  fitKey,
  onMapClick,
  interactive = true,
  initialCenter = DEFAULT_CENTER,
  initialZoom = 13,
  className,
  ariaLabel = 'Map',
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayers = useRef(new Map<string, { layer: L.Marker; html: string; label?: string }>());
  const lineLayers = useRef(new Map<string, L.Polyline>());
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const markerClicks = useRef(new Map<string, (() => void) | undefined>());

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: initialZoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      keyboard: interactive,
      boxZoom: interactive,
      attributionControl: true,
    });
    // Standard OSM tiles need no API key; styles.css desaturates them so markers carry the colour.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'wp-tiles',
    }).addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => {
      clickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    // Suspend the glide while zooming, or markers would slide into their re-projected spots.
    const container = containerRef.current;
    let zoomTimer: ReturnType<typeof setTimeout> | undefined;
    map.on('zoomstart', () => {
      clearTimeout(zoomTimer);
      container.classList.add('is-zooming');
    });
    map.on('zoomend', () => {
      zoomTimer = setTimeout(() => container.classList.remove('is-zooming'), 80);
    });
    mapRef.current = map;

    // The panel layout can change size after mount (mobile stacking, fonts loading).
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    const markersMap = markerLayers.current;
    const linesMap = lineLayers.current;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markersMap.clear();
      linesMap.clear();
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const marker of markers) {
      seen.add(marker.id);
      markerClicks.current.set(marker.id, marker.onClick);
      const html = markerHtml(marker);
      const existing = markerLayers.current.get(marker.id);
      if (existing) {
        existing.layer.setLatLng([marker.position.lat, marker.position.lng]);
        if (existing.html !== html) {
          existing.layer.setIcon(iconFor(marker));
          existing.html = html;
        }
        if (existing.label !== marker.label) {
          existing.layer.unbindTooltip();
          if (marker.label) existing.layer.bindTooltip(marker.label, { direction: 'top', className: 'wp-tooltip' });
          existing.label = marker.label;
        }
      } else {
        const layer = L.marker([marker.position.lat, marker.position.lng], {
          icon: iconFor(marker),
          keyboard: false,
          zIndexOffset: marker.kind.startsWith('driver') ? 500 : 0,
        });
        if (marker.label) layer.bindTooltip(marker.label, { direction: 'top', className: 'wp-tooltip' });
        layer.on('click', (event: L.LeafletMouseEvent) => {
          const handler = markerClicks.current.get(marker.id);
          if (handler) {
            L.DomEvent.stopPropagation(event);
            handler();
          }
        });
        layer.addTo(map);
        markerLayers.current.set(marker.id, { layer, html, label: marker.label });
      }
    }
    for (const [id, entry] of markerLayers.current) {
      if (!seen.has(id)) {
        entry.layer.remove();
        markerLayers.current.delete(id);
        markerClicks.current.delete(id);
      }
    }
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const line of lines) {
      if (line.points.length < 2) continue;
      seen.add(line.id);
      const latLngs = line.points.map((p) => [p.lat, p.lng] as L.LatLngTuple);
      const existing = lineLayers.current.get(line.id);
      if (existing) {
        existing.setLatLngs(latLngs);
        existing.setStyle(LINE_STYLE[line.kind]);
      } else {
        const layer = L.polyline(latLngs, { ...LINE_STYLE[line.kind], interactive: false }).addTo(map);
        layer.bringToBack();
        lineLayers.current.set(line.id, layer);
      }
    }
    for (const [id, layer] of lineLayers.current) {
      if (!seen.has(id)) {
        layer.remove();
        lineLayers.current.delete(id);
      }
    }
  }, [lines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitKey === undefined) return;
    const points: L.LatLngTuple[] = [
      ...markers.map((m) => [m.position.lat, m.position.lng] as L.LatLngTuple),
      ...lines.flatMap((l) => l.points.map((p) => [p.lat, p.lng] as L.LatLngTuple)),
    ];
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 14));
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 15 });
    }
    // Only re-fit when the caller says the subject changed, not on every driver move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // Leaflet adds its own classes (leaflet-container, …) to the element it's mounted on. That element's
  // className must never be managed by React: a re-render with a different class string would wipe
  // them, and the map would lose its overflow clipping and spill over the rest of the page.
  return (
    <div className={`map ${onMapClick ? 'map--pickable' : ''} ${className ?? ''}`} role="region" aria-label={ariaLabel}>
      <div ref={containerRef} className="map__canvas" />
    </div>
  );
}
