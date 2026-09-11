import type { LatLng } from '../api/types';

/** Same constant as properties.vehicle.speed in application.yaml (km/h). */
export const AVERAGE_SPEED_KMH = 40;

/** Great-circle distance in km — mirrors GeoLocationHelper.haversine on the backend. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Straight-line ETA in whole minutes, exactly as DriverLocationService computes it. */
export function etaMinutes(distanceKm: number): number {
  return Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60);
}

/** Point `meters` along the straight line from `from` towards `to` (clamped at `to`). */
export function stepTowards(from: LatLng, to: LatLng, meters: number): LatLng {
  const total = haversineKm(from, to) * 1000;
  if (total <= meters || total === 0) {
    return { ...to };
  }
  const t = meters / total;
  return { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
}

/** Smoothstep-eased interpolation, the same curve the Node driver simulator uses. */
export function easedPoint(from: LatLng, to: LatLng, t: number): LatLng {
  const clamped = Math.min(1, Math.max(0, t));
  const eased = clamped * clamped * (3 - 2 * clamped);
  return { lat: from.lat + (to.lat - from.lat) * eased, lng: from.lng + (to.lng - from.lng) * eased };
}

export function isValidPosition(position: Partial<LatLng> | null | undefined): position is LatLng {
  return (
    !!position &&
    typeof position.lat === 'number' &&
    typeof position.lng === 'number' &&
    Number.isFinite(position.lat) &&
    Number.isFinite(position.lng) &&
    position.lat >= -90 &&
    position.lat <= 90 &&
    position.lng >= -180 &&
    position.lng <= 180
  );
}
