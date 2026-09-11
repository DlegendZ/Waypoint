import type { DriverStatus, LatLng, Stage } from '../api/types';

export const STAGE_LABEL: Record<Stage, string> = {
  CREATED: 'Waiting for a driver',
  ASSIGNED: 'Driver assigned',
  PICKED_UP: 'Picked up',
  ON_THE_WAY: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const DRIVER_STATUS_LABEL: Record<DriverStatus, string> = {
  OFFLINE: 'Offline',
  ONLINE_AVAILABLE: 'Available',
  ONLINE_BUSY: 'On a delivery',
};

/**
 * Backend timestamps carry an offset ("…Z" / "+07:00"). Older rows serialised before that change
 * have none; those were written in the server's zone (UTC in the Docker image), so read them as UTC.
 */
export function parseServerTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(value: string | null | undefined): string {
  const date = parseServerTime(value);
  if (!date) {
    return '—';
  }
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(date: Date | null, now = Date.now()): string {
  if (!date) {
    return 'never';
  }
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return '—';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatEta(minutes: number): string {
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatPosition(position: LatLng | null | undefined): string {
  if (!position) return 'Not set';
  return `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
}
