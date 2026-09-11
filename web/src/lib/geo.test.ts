import { describe, expect, it } from 'vitest';
import { easedPoint, etaMinutes, haversineKm, isValidPosition, stepTowards } from './geo';
import { parseServerTime } from './format';
import { parseTarget } from '../config';

describe('geo', () => {
  it('matches the backend haversine for one degree of latitude', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });

  it('computes ETA the way DriverLocationService does', () => {
    expect(etaMinutes(10)).toBe(15);
    expect(etaMinutes(0)).toBe(0);
  });

  it('steps towards a target without overshooting', () => {
    const to = { lat: -6.19, lng: 106.83 };
    expect(stepTowards({ lat: -6.2, lng: 106.83 }, to, 1_000_000)).toEqual(to);
    const halfway = stepTowards({ lat: -6.2, lng: 106.83 }, to, 556);
    expect(halfway.lat).toBeGreaterThan(-6.2);
    expect(halfway.lat).toBeLessThan(-6.19);
  });

  it('eases between two points and clamps t', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 10, lng: 10 };
    expect(easedPoint(a, b, 0)).toEqual(a);
    expect(easedPoint(a, b, 2)).toEqual(b);
    expect(easedPoint(a, b, 0.5)).toEqual({ lat: 5, lng: 5 });
  });

  it('validates coordinate ranges', () => {
    expect(isValidPosition({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidPosition({ lat: -6.2, lng: 106.8 })).toBe(true);
    expect(isValidPosition(null)).toBe(false);
  });
});

describe('format', () => {
  it('reads zone-less server timestamps as UTC', () => {
    expect(parseServerTime('2026-09-11T08:00:00')?.toISOString()).toBe('2026-09-11T08:00:00.000Z');
    expect(parseServerTime('2026-09-11T08:00:00+07:00')?.toISOString()).toBe('2026-09-11T01:00:00.000Z');
    expect(parseServerTime(null)).toBeNull();
  });
});

describe('config', () => {
  it('parses API targets', () => {
    expect(parseTarget('')).toEqual({ kind: 'demo' });
    expect(parseTarget('demo')).toEqual({ kind: 'demo' });
    expect(parseTarget('/')).toEqual({ kind: 'live', baseUrl: '' });
    expect(parseTarget('https://api.example.com/')).toEqual({ kind: 'live', baseUrl: 'https://api.example.com' });
  });
});
