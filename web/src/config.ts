/**
 * Where the web client sends requests.
 *
 *   VITE_API_URL (build time)        "demo" / empty -> in-browser demo backend
 *                                    "/"            -> same origin (Vite dev proxy, or served by the API)
 *                                    "https://..."  -> that server (needs CORS + SameSite=None on the API)
 *
 * A visitor can override it from the "Server" dialog; the choice is kept in localStorage.
 */
const OVERRIDE_KEY = 'waypoint-api-url';

export type ApiTarget = { kind: 'demo' } | { kind: 'live'; baseUrl: string };

export function parseTarget(raw: string | null | undefined): ApiTarget {
  const value = (raw ?? '').trim();
  if (!value || value.toLowerCase() === 'demo') {
    return { kind: 'demo' };
  }
  if (value === '/' || value.toLowerCase() === 'same-origin') {
    return { kind: 'live', baseUrl: '' };
  }
  return { kind: 'live', baseUrl: value.replace(/\/+$/, '') };
}

export function buildDefaultTarget(): ApiTarget {
  return parseTarget(import.meta.env.VITE_API_URL as string | undefined);
}

export function resolveTarget(): ApiTarget {
  try {
    const override = window.localStorage.getItem(OVERRIDE_KEY);
    if (override !== null) {
      return parseTarget(override);
    }
  } catch {
    // storage blocked: fall back to the build default
  }
  return buildDefaultTarget();
}

export function saveTargetOverride(raw: string | null) {
  try {
    if (raw === null) window.localStorage.removeItem(OVERRIDE_KEY);
    else window.localStorage.setItem(OVERRIDE_KEY, raw);
  } catch {
    // ignore
  }
}

export function describeTarget(target: ApiTarget): string {
  if (target.kind === 'demo') return 'demo';
  return target.baseUrl || '/';
}
