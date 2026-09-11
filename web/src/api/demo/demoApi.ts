import { ApiError, type RealtimeConnection, type RealtimeState, type WaypointApi } from '../client';
import type { CreateOrderRequest, DriverStatus, LatLng, LocationUpdate, RegisterRequest, Stage } from '../types';
import { DemoEngine } from './engine';

const SESSION_KEY = 'waypoint-demo-session';

// One engine per page. A second instance in the same tab (React StrictMode re-running useMemo,
// or a hot reload) would run its own simulation loop against its own copy of the state.
let sharedEngine: DemoEngine | null = null;
function getSharedEngine(): DemoEngine {
  sharedEngine ??= new DemoEngine();
  return sharedEngine;
}
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sharedEngine?.stop();
    sharedEngine = null;
  });
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * WaypointApi backed by DemoEngine. The signed-in user is kept per tab (sessionStorage), so you can
 * be the customer in one tab and the driver in another and watch the live link between them.
 */
export class DemoApi implements WaypointApi {
  readonly mode = 'demo' as const;
  readonly target = 'Demo data in this browser';
  private userId: number | null;

  constructor(readonly engine: DemoEngine = getSharedEngine()) {
    const stored = Number(sessionStore()?.getItem(SESSION_KEY));
    this.userId = Number.isFinite(stored) && stored > 0 ? stored : null;
    engine.start();
  }

  /** A short pause makes loading states visible, as they would be against a real server. */
  private async run<T>(work: () => T, delay = 120): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return work();
  }

  private actor(): number {
    if (this.userId == null) {
      throw new ApiError(401, 'Your session has ended. Sign in again.');
    }
    return this.userId;
  }

  private setSession(userId: number | null) {
    this.userId = userId;
    const store = sessionStore();
    if (userId == null) store?.removeItem(SESSION_KEY);
    else store?.setItem(SESSION_KEY, String(userId));
  }

  register(request: RegisterRequest) {
    return this.run(() => this.engine.register(request));
  }

  login(email: string, password: string) {
    return this.run(() => {
      const user = this.engine.login(email, password);
      this.setSession(user.id);
      return user;
    }, 250);
  }

  logout() {
    return this.run(() => this.setSession(null));
  }

  me() {
    return this.run(() => (this.userId == null ? null : this.engine.me(this.userId)), 0);
  }

  createOrder(request: CreateOrderRequest) {
    return this.run(() => this.engine.createOrder(this.actor(), request), 300);
  }

  listOrders() {
    return this.run(() => this.engine.listOrders(this.actor()), 60);
  }

  getOrder(orderId: number) {
    return this.run(() => this.engine.getOrder(this.actor(), orderId), 60);
  }

  getHistory(orderId: number) {
    return this.run(() => this.engine.getHistory(this.actor(), orderId));
  }

  getLatestLocation(orderId: number) {
    return this.run(() => this.engine.getLatestLocation(this.actor(), orderId), 60);
  }

  updateOrderStage(orderId: number, stage: Stage) {
    return this.run(() => this.engine.updateStage(this.actor(), orderId, stage));
  }

  getDriverProfile() {
    return this.run(() => this.engine.getProfile(this.actor()), 60);
  }

  updateDriverStatus(status: DriverStatus, position?: LatLng) {
    return this.run(() => this.engine.updateDriverStatus(this.actor(), status, position));
  }

  getOverview() {
    return this.run(() => this.engine.overview(this.actor()), 60);
  }

  listDrivers() {
    return this.run(() => this.engine.drivers(this.actor()), 60);
  }

  openRealtime(): RealtimeConnection {
    return new DemoRealtime(this.engine, this.actor());
  }
}

/** Simulated STOMP link with the same rules: customers may only subscribe to their own order. */
class DemoRealtime implements RealtimeConnection {
  private readonly listeners = new Set<(state: RealtimeState, detail?: string) => void>();
  private state: RealtimeState = 'connecting';
  private detail: string | undefined;
  private readonly unsubscribers = new Set<() => void>();
  private readonly connectTimer: ReturnType<typeof setTimeout>;

  constructor(
    private readonly engine: DemoEngine,
    private readonly userId: number,
  ) {
    this.connectTimer = setTimeout(() => this.setState('connected'), 250);
    window.addEventListener('pagehide', this.onPageHide);
  }

  private onPageHide = () => {
    this.engine.handleDisconnect(this.userId);
  };

  private setState(state: RealtimeState, detail?: string) {
    this.state = state;
    this.detail = detail;
    for (const listener of this.listeners) listener(state, detail);
  }

  subscribeOrder(orderId: number, onUpdate: (update: LocationUpdate) => void) {
    if (!this.engine.canSubscribe(this.userId, orderId)) {
      this.setState('error', 'You are not allowed to subscribe to this order');
      return () => {};
    }
    const off = this.engine.onLocation((id, update) => {
      if (id === orderId && this.state === 'connected') onUpdate(update);
    });
    this.unsubscribers.add(off);
    return () => {
      off();
      this.unsubscribers.delete(off);
    };
  }

  publishLocation(orderId: number, position: LatLng) {
    if (this.state !== 'connected') return false;
    try {
      this.engine.saveLocation(this.userId, orderId, position);
    } catch {
      // The real server also drops rejected pings without replying.
    }
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
    clearTimeout(this.connectTimer);
    window.removeEventListener('pagehide', this.onPageHide);
    for (const off of this.unsubscribers) off();
    this.unsubscribers.clear();
    this.listeners.clear();
    this.state = 'closed';
    this.engine.handleDisconnect(this.userId);
  }
}
