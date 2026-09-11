import { Client, type StompSubscription } from '@stomp/stompjs';
import type { RealtimeConnection, RealtimeState } from './client';
import type { LatLng, LocationUpdate } from './types';

/**
 * STOMP over a plain WebSocket. The browser sends the auth cookie with the upgrade request, which
 * JwtHandshakeInterceptor reads on the server. Subscriptions are remembered and replayed after
 * every reconnect (stompjs drops them when the socket closes).
 */
export class StompRealtime implements RealtimeConnection {
  private readonly client: Client;
  private readonly wanted = new Map<number, Set<(update: LocationUpdate) => void>>();
  private readonly live = new Map<number, StompSubscription>();
  private readonly listeners = new Set<(state: RealtimeState, detail?: string) => void>();
  private state: RealtimeState = 'connecting';
  private detail: string | undefined;

  constructor(url: string) {
    this.client = new Client({
      brokerURL: url,
      reconnectDelay: 4000,
      // Spring's simple broker has no heartbeat scheduler configured.
      heartbeatIncoming: 0,
      heartbeatOutgoing: 0,
      onConnect: () => {
        this.live.clear();
        for (const orderId of this.wanted.keys()) {
          this.subscribeOnServer(orderId);
        }
        this.setState('connected');
      },
      onStompError: (frame) => {
        this.setState('error', frame.headers.message || 'The server rejected the live connection.');
      },
      onWebSocketError: () => {
        this.setState('error', "Couldn't open the live connection. Retrying…");
      },
      onWebSocketClose: () => {
        this.live.clear();
        if (this.state !== 'closed' && this.state !== 'error') {
          this.setState('connecting');
        }
      },
    });
    this.client.activate();
  }

  private setState(state: RealtimeState, detail?: string) {
    this.state = state;
    this.detail = detail;
    for (const listener of this.listeners) {
      listener(state, detail);
    }
  }

  private subscribeOnServer(orderId: number) {
    if (!this.client.connected || this.live.has(orderId)) {
      return;
    }
    const subscription = this.client.subscribe(`/topic/order/${orderId}`, (message) => {
      let update: LocationUpdate;
      try {
        update = JSON.parse(message.body) as LocationUpdate;
      } catch {
        return;
      }
      for (const callback of this.wanted.get(orderId) ?? []) {
        callback(update);
      }
    });
    this.live.set(orderId, subscription);
  }

  subscribeOrder(orderId: number, onUpdate: (update: LocationUpdate) => void) {
    let callbacks = this.wanted.get(orderId);
    if (!callbacks) {
      callbacks = new Set();
      this.wanted.set(orderId, callbacks);
    }
    callbacks.add(onUpdate);
    this.subscribeOnServer(orderId);

    return () => {
      const current = this.wanted.get(orderId);
      current?.delete(onUpdate);
      if (current && current.size === 0) {
        this.wanted.delete(orderId);
        const subscription = this.live.get(orderId);
        this.live.delete(orderId);
        if (subscription && this.client.connected) {
          subscription.unsubscribe();
        }
      }
    };
  }

  publishLocation(orderId: number, position: LatLng) {
    if (!this.client.connected) {
      return false;
    }
    this.client.publish({
      destination: `/app/location/${orderId}`,
      body: JSON.stringify({ lat: position.lat, lng: position.lng }),
    });
    return true;
  }

  onStateChange(listener: (state: RealtimeState, detail?: string) => void) {
    this.listeners.add(listener);
    listener(this.state, this.detail);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close() {
    this.state = 'closed';
    this.listeners.clear();
    this.wanted.clear();
    this.live.clear();
    void this.client.deactivate();
  }
}
