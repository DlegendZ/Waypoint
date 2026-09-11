import { useEffect, useState } from 'react';
import type { RealtimeConnection, RealtimeState, WaypointApi } from '../api/client';

/**
 * Opens a live connection while `enabled` and closes it on cleanup. Opening is deferred by a tick so
 * React StrictMode's mount-unmount-mount in development doesn't open and drop a socket — for a driver,
 * a dropped socket means the server marks them offline and flags their active order.
 */
export function useRealtime(api: WaypointApi, enabled: boolean) {
  const [connection, setConnection] = useState<RealtimeConnection | null>(null);
  const [state, setState] = useState<RealtimeState>('closed');
  const [detail, setDetail] = useState<string | undefined>();

  useEffect(() => {
    if (!enabled) {
      setState('closed');
      setDetail(undefined);
      return;
    }
    let opened: RealtimeConnection | null = null;
    let stopListening = () => {};
    const timer = setTimeout(() => {
      opened = api.openRealtime();
      stopListening = opened.onStateChange((next, why) => {
        setState(next);
        setDetail(why);
      });
      setConnection(opened);
    }, 0);

    return () => {
      clearTimeout(timer);
      stopListening();
      opened?.close();
      setConnection(null);
      setState('closed');
    };
  }, [api, enabled]);

  return { connection, state, detail };
}
