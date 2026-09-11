import { useEffect, useRef, useState } from 'react';

/** Runs `callback` every `ms` while enabled, always calling the latest closure. Also runs once immediately. */
export function usePolling(callback: () => void | Promise<void>, ms: number, enabled = true) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        await saved.current();
      } finally {
        if (!cancelled) timer = setTimeout(run, ms);
      }
    };
    void run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ms, enabled]);
}

/** Current time, re-rendered every `ms` — for "updated 5s ago" labels. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Browser geolocation as a promise with a readable error. */
export function currentDevicePosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error("This browser can't share its location. Click the map instead."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? 'Location access was blocked. Allow it in the browser, or click the map instead.'
              : "Couldn't get your location. Click the map instead.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}
