// Mirrors the backend DTOs in App/src/main/java/com/raynald/waypoint/dto.

export type Role = 'CUSTOMER' | 'DRIVER' | 'DISPATCHER';
export type Stage = 'CREATED' | 'ASSIGNED' | 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';
export type DriverStatus = 'OFFLINE' | 'ONLINE_AVAILABLE' | 'ONLINE_BUSY';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'DRIVER';
}

export interface CreateOrderRequest {
  pickUpLat: number;
  pickUpLng: number;
  dropOffLat: number;
  dropOffLng: number;
}

export interface Order {
  id: number;
  customerId: number;
  customerName: string | null;
  driverId: number | null;
  driverName: string | null;
  pickUpLat: number;
  pickUpLng: number;
  dropOffLat: number;
  dropOffLng: number;
  currentStage: Stage;
  createdAt: string;
  flagged: boolean;
  flagReason: string | null;
}

/** Payload broadcast on /topic/order/{id} and returned by GET /api/orders/{id}/location. */
export interface LocationUpdate {
  lat: number;
  lng: number;
  /** Minutes to the current target (pick-up while ASSIGNED, drop-off afterwards). */
  eta: number;
  /** Kilometres to the current target. */
  distance: number;
  /** Epoch seconds. */
  timestamp: string;
}

export interface StageChange {
  fromStage: Stage;
  toStage: Stage;
  changedAt: string;
  actorId: number | null;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface OrderHistory {
  order: Order;
  stages: StageChange[];
  route: RoutePoint[];
}

export interface DriverProfile {
  id: number;
  userId: number;
  name: string | null;
  status: DriverStatus;
  currentLat: number | null;
  currentLng: number | null;
  lastUpdatedAt: string | null;
}

export interface FlaggedOrder {
  orderId: number;
  reason: string | null;
  flaggedAt: string | null;
}

export interface DispatchOverview {
  orderByStage: Partial<Record<Stage, number>>;
  driverByStatus: Partial<Record<DriverStatus, number>>;
  flaggedOrders: FlaggedOrder[];
}

export const ACTIVE_STAGES: Stage[] = ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];
export const OPEN_STAGES: Stage[] = ['CREATED', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'];

/** Same map as OrderService.ALLOWED_TRANSITIONS on the backend. */
export const ALLOWED_TRANSITIONS: Record<Stage, Stage[]> = {
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['ON_THE_WAY'],
  ON_THE_WAY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};
