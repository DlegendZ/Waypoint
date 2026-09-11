import type {
  CreateOrderRequest,
  DispatchOverview,
  DriverProfile,
  DriverStatus,
  LatLng,
  LocationUpdate,
  Order,
  OrderHistory,
  RegisterRequest,
  Stage,
  User,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RealtimeState = 'connecting' | 'connected' | 'error' | 'closed';

/** One live STOMP (or simulated) connection, owned by a view and closed when it unmounts. */
export interface RealtimeConnection {
  /** Customer only: live driver position + ETA for one of their orders. Returns an unsubscribe function. */
  subscribeOrder(orderId: number, onUpdate: (update: LocationUpdate) => void): () => void;
  /** Driver only: send a location ping for an order they're assigned to. False when not connected. */
  publishLocation(orderId: number, position: LatLng): boolean;
  onStateChange(listener: (state: RealtimeState, detail?: string) => void): () => void;
  close(): void;
}

/** Everything the UI needs from the backend. Implemented over HTTP (live) and in the browser (demo). */
export interface WaypointApi {
  readonly mode: 'live' | 'demo';
  /** Human-readable description of where requests go. */
  readonly target: string;

  register(request: RegisterRequest): Promise<User>;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  /** Current user from the session, or null when signed out. */
  me(): Promise<User | null>;

  createOrder(request: CreateOrderRequest): Promise<Order>;
  listOrders(): Promise<Order[]>;
  getOrder(orderId: number): Promise<Order>;
  getHistory(orderId: number): Promise<OrderHistory>;
  /** Latest known driver position for an order, or null when the driver hasn't sent one yet. */
  getLatestLocation(orderId: number): Promise<LocationUpdate | null>;
  updateOrderStage(orderId: number, stage: Stage): Promise<Order>;

  getDriverProfile(): Promise<DriverProfile>;
  updateDriverStatus(status: DriverStatus, position?: LatLng): Promise<DriverProfile>;

  getOverview(): Promise<DispatchOverview>;
  listDrivers(): Promise<DriverProfile[]>;

  openRealtime(): RealtimeConnection;
}
