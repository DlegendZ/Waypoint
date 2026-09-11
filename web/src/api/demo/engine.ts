import { ApiError } from '../client';
import {
  ACTIVE_STAGES,
  ALLOWED_TRANSITIONS,
  type CreateOrderRequest,
  type DispatchOverview,
  type DriverProfile,
  type DriverStatus,
  type LatLng,
  type LocationUpdate,
  type Order,
  type OrderHistory,
  type RegisterRequest,
  type Role,
  type Stage,
  type User,
} from '../types';
import { etaMinutes, haversineKm, isValidPosition, stepTowards } from '../../lib/geo';

/**
 * In-browser stand-in for the Spring Boot backend, used when no server is configured (e.g. the public
 * GitHub Pages demo). It applies the same rules as the real services — state machine, nearest-driver
 * matching, ownership checks, ETA — and runs a handful of simulated drivers so the map has life.
 *
 * State lives in localStorage and is shared between tabs. Every public call re-reads it first, so an
 * engine never acts on a stale copy; one tab at a time (the "leader") drives the simulated drivers.
 */

interface DemoUser extends User {
  password: string;
  bot: boolean;
}

interface DemoProfile {
  id: number;
  userId: number;
  status: DriverStatus;
  currentLat: number | null;
  currentLng: number | null;
  lastUpdatedAt: string;
}

interface DemoOrder {
  id: number;
  customerId: number;
  driverId: number | null;
  pickUpLat: number;
  pickUpLng: number;
  dropOffLat: number;
  dropOffLng: number;
  currentStage: Stage;
  createdAt: string;
  flagged: boolean;
  flagReason: string | null;
  flaggedAt: string | null;
}

interface BotState {
  phase: 'idle' | 'toPickup' | 'loading' | 'toDropoff' | 'unloading';
  orderId: number | null;
  waitUntil: number;
  cruise: LatLng | null;
}

export interface DemoState {
  version: number;
  nextId: { user: number; profile: number; order: number };
  users: DemoUser[];
  profiles: DemoProfile[];
  orders: DemoOrder[];
  stageHistory: { orderId: number; fromStage: Stage; toStage: Stage; changedAt: string; actorId: number | null }[];
  locations: { orderId: number; lat: number; lng: number; recordedAt: string }[];
  latest: Record<string, LatLng>;
  bots: Record<string, BotState>;
}

const STATE_VERSION = 3;
const STORAGE_KEY = 'waypoint-demo-state';
const LEADER_KEY = 'waypoint-demo-leader';
const CHANNEL = 'waypoint-demo';
export const DEMO_PASSWORD = 'password123';
export const DEMO_ACCOUNTS = {
  customer: 'customer@waypoint.demo',
  driver: 'driver@waypoint.demo',
  dispatcher: 'dispatcher@waypoint.demo',
} as const;

/** Simulated drivers move faster than real traffic so a trip plays out in under a minute. */
const BOT_SPEED_MPS = 85;
const BOT_CRUISE_MPS = 10;
const MAX_ROUTE_POINTS_PER_ORDER = 400;
/** Keeps the whole demo comfortably inside the ~5 MB localStorage quota. */
const MAX_ROUTE_POINTS_TOTAL = 5000;

const JAKARTA: LatLng = { lat: -6.2, lng: 106.83 };

const nowIso = () => new Date().toISOString();

function seedState(): DemoState {
  const t = Date.now();
  const iso = (offsetMinutes: number) => new Date(t - offsetMinutes * 60_000).toISOString();

  const users: DemoUser[] = [
    { id: 1, name: 'Demo Customer', email: DEMO_ACCOUNTS.customer, role: 'CUSTOMER', password: DEMO_PASSWORD, bot: false },
    { id: 2, name: 'Demo Driver', email: DEMO_ACCOUNTS.driver, role: 'DRIVER', password: DEMO_PASSWORD, bot: false },
    { id: 3, name: 'Demo Dispatcher', email: DEMO_ACCOUNTS.dispatcher, role: 'DISPATCHER', password: DEMO_PASSWORD, bot: false },
  ];
  const botSeeds: [string, number, number][] = [
    ['Budi Santoso', -6.1862, 106.8227],
    ['Sari Wulandari', -6.2253, 106.8021],
    ['Andi Pratama', -6.2089, 106.8456],
    ['Dewi Lestari', -6.1702, 106.8412],
    ['Rizky Hidayat', -6.2415, 106.8322],
    ['Maya Putri', -6.1951, 106.7983],
  ];
  const profiles: DemoProfile[] = [
    { id: 1, userId: 2, status: 'OFFLINE', currentLat: -6.1754, currentLng: 106.8272, lastUpdatedAt: iso(30) },
  ];
  const bots: Record<string, BotState> = {};
  botSeeds.forEach(([name, lat, lng], index) => {
    const id = 10 + index;
    users.push({
      id,
      name,
      email: `${name.split(' ')[0].toLowerCase()}@fleet.waypoint.demo`,
      role: 'DRIVER',
      password: DEMO_PASSWORD,
      bot: true,
    });
    profiles.push({ id: profiles.length + 1, userId: id, status: 'ONLINE_AVAILABLE', currentLat: lat, currentLng: lng, lastUpdatedAt: iso(1) });
    bots[id] = { phase: 'idle', orderId: null, waitUntil: 0, cruise: null };
  });

  // One finished trip so history, route replay and the dispatcher board aren't empty on first visit.
  const pickup = { lat: -6.1945, lng: 106.8229 };
  const dropoff = { lat: -6.2183, lng: 106.8412 };
  const route: DemoState['locations'] = [];
  const botStart = { lat: -6.1862, lng: 106.8227 };
  for (let i = 0; i <= 12; i++) {
    const from = i <= 4 ? botStart : pickup;
    const to = i <= 4 ? pickup : dropoff;
    const t2 = i <= 4 ? i / 4 : (i - 4) / 8;
    route.push({
      orderId: 1,
      lat: from.lat + (to.lat - from.lat) * t2,
      lng: from.lng + (to.lng - from.lng) * t2,
      recordedAt: iso(95 - i * 2),
    });
  }

  return {
    version: STATE_VERSION,
    nextId: { user: 100, profile: profiles.length + 1, order: 2 },
    users,
    profiles,
    orders: [
      {
        id: 1,
        customerId: 1,
        driverId: 10,
        pickUpLat: pickup.lat,
        pickUpLng: pickup.lng,
        dropOffLat: dropoff.lat,
        dropOffLng: dropoff.lng,
        currentStage: 'DELIVERED',
        createdAt: iso(96),
        flagged: false,
        flagReason: null,
        flaggedAt: null,
      },
    ],
    stageHistory: [
      { orderId: 1, fromStage: 'CREATED', toStage: 'ASSIGNED', changedAt: iso(96), actorId: null },
      { orderId: 1, fromStage: 'ASSIGNED', toStage: 'PICKED_UP', changedAt: iso(87), actorId: 10 },
      { orderId: 1, fromStage: 'PICKED_UP', toStage: 'ON_THE_WAY', changedAt: iso(86), actorId: 10 },
      { orderId: 1, fromStage: 'ON_THE_WAY', toStage: 'DELIVERED', changedAt: iso(71), actorId: 10 },
    ],
    locations: route,
    latest: { 1: dropoff },
    bots,
  };
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

type LocationListener = (orderId: number, update: LocationUpdate) => void;

export class DemoEngine {
  private state: DemoState;
  private readonly tabId = Math.random().toString(36).slice(2);
  private readonly locationListeners = new Set<LocationListener>();
  private channel: BroadcastChannel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Off while tick() runs, so the internal calls it makes don't reload state mid-update. */
  private syncing = true;

  constructor(
    private readonly storage: Storage | null = safeStorage(),
    private readonly clock: () => number = Date.now,
  ) {
    this.state = this.load();
  }

  // ---------------------------------------------------------------- lifecycle

  /** Starts the simulation loop and cross-tab sync. Tests drive `tick()` by hand instead. */
  start() {
    if (this.timer || typeof window === 'undefined') {
      return;
    }
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (event: MessageEvent) => {
        const data = event.data as { orderId: number; update: LocationUpdate } | null;
        if (data && typeof data.orderId === 'number') {
          this.emitLocal(data.orderId, data.update);
        }
      };
    }
    this.timer = setInterval(() => {
      if (this.claimLeadership()) {
        this.tick();
      }
    }, 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.channel?.close();
    this.channel = null;
    this.locationListeners.clear();
  }

  reset() {
    this.state = seedState();
    this.save();
  }

  private sync() {
    if (this.syncing) {
      this.state = this.load();
    }
  }

  private load(): DemoState {
    const raw = this.storage?.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed.version === STATE_VERSION) {
          return parsed;
        }
      } catch {
        // fall through to a fresh seed
      }
    }
    // Storage blocked or empty: keep working from memory (or start fresh).
    if (!this.storage && this.state) {
      return this.state;
    }
    const fresh = seedState();
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // ignore
    }
    return fresh;
  }

  private save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage full or blocked: the demo keeps working in memory for this tab.
    }
  }

  /** Only one tab runs the simulated drivers; another takes over if it goes quiet for 3 s. */
  private claimLeadership(): boolean {
    if (!this.storage) {
      return true;
    }
    const now = this.clock();
    try {
      const current = JSON.parse(this.storage.getItem(LEADER_KEY) ?? 'null') as { id: string; at: number } | null;
      if (!current || current.id === this.tabId || now - current.at > 3000) {
        this.storage.setItem(LEADER_KEY, JSON.stringify({ id: this.tabId, at: now }));
        return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  // ---------------------------------------------------------------- lookups

  private user(id: number): DemoUser {
    const user = this.state.users.find((u) => u.id === id);
    if (!user) {
      throw new ApiError(401, 'Your session has ended. Sign in again.');
    }
    return user;
  }

  private order(id: number): DemoOrder {
    const order = this.state.orders.find((o) => o.id === id);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    return order;
  }

  private profileOf(userId: number): DemoProfile | undefined {
    return this.state.profiles.find((p) => p.userId === userId);
  }

  private requireRole(actorId: number, role: Role): DemoUser {
    const actor = this.user(actorId);
    if (actor.role !== role) {
      throw new ApiError(403, "Your account doesn't have access to that.");
    }
    return actor;
  }

  private toUser(user: DemoUser): User {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  private toOrder(order: DemoOrder): Order {
    const customer = this.state.users.find((u) => u.id === order.customerId);
    const driver = order.driverId != null ? this.state.users.find((u) => u.id === order.driverId) : undefined;
    return {
      id: order.id,
      customerId: order.customerId,
      customerName: customer?.name ?? null,
      driverId: order.driverId,
      driverName: driver?.name ?? null,
      pickUpLat: order.pickUpLat,
      pickUpLng: order.pickUpLng,
      dropOffLat: order.dropOffLat,
      dropOffLng: order.dropOffLng,
      currentStage: order.currentStage,
      createdAt: order.createdAt,
      flagged: order.flagged,
      flagReason: order.flagReason,
    };
  }

  private toProfile(profile: DemoProfile): DriverProfile {
    return {
      id: profile.id,
      userId: profile.userId,
      name: this.state.users.find((u) => u.id === profile.userId)?.name ?? null,
      status: profile.status,
      currentLat: profile.currentLat,
      currentLng: profile.currentLng,
      lastUpdatedAt: profile.lastUpdatedAt,
    };
  }

  private hasActiveOrder(driverId: number): boolean {
    return this.state.orders.some((o) => o.driverId === driverId && ACTIVE_STAGES.includes(o.currentStage));
  }

  // ---------------------------------------------------------------- auth

  register(request: RegisterRequest): User {
    this.sync();
    const name = request.name?.trim();
    const email = request.email?.trim().toLowerCase();
    if (!name) throw new ApiError(400, 'name: Name is required');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'email: Email must be a valid address');
    if (!request.password || request.password.length < 8 || request.password.length > 72) {
      throw new ApiError(400, 'password: Password must be 8-72 characters');
    }
    if ((request.role as string) === 'DISPATCHER') throw new ApiError(400, 'Dispatcher accounts cannot be self-registered.');
    if (request.role !== 'CUSTOMER' && request.role !== 'DRIVER') throw new ApiError(400, 'Role is required');
    if (this.state.users.some((u) => u.email === email)) throw new ApiError(409, 'Email already registered.');

    const user: DemoUser = { id: this.state.nextId.user++, name, email, role: request.role, password: request.password, bot: false };
    this.state.users.push(user);
    if (user.role === 'DRIVER') {
      this.state.profiles.push({
        id: this.state.nextId.profile++,
        userId: user.id,
        status: 'OFFLINE',
        currentLat: null,
        currentLng: null,
        lastUpdatedAt: nowIso(),
      });
    }
    this.save();
    return this.toUser(user);
  }

  login(email: string, password: string): User {
    this.sync();
    const user = this.state.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.password !== password) {
      throw new ApiError(401, 'Invalid email or password');
    }
    return this.toUser(user);
  }

  me(userId: number): User | null {
    this.sync();
    const user = this.state.users.find((u) => u.id === userId);
    return user ? this.toUser(user) : null;
  }

  // ---------------------------------------------------------------- orders

  createOrder(actorId: number, request: CreateOrderRequest): Order {
    this.sync();
    const customer = this.requireRole(actorId, 'CUSTOMER');
    const pickup = { lat: request.pickUpLat, lng: request.pickUpLng };
    const dropoff = { lat: request.dropOffLat, lng: request.dropOffLng };
    if (!isValidPosition(pickup) || !isValidPosition(dropoff)) {
      throw new ApiError(400, 'Invalid latitude/longitude');
    }

    // Nearest ONLINE_AVAILABLE driver with a known position — OrderService.createOrder.
    let nearest: DemoProfile | null = null;
    let nearestKm = Infinity;
    for (const profile of this.state.profiles) {
      if (profile.status !== 'ONLINE_AVAILABLE' || profile.currentLat == null || profile.currentLng == null) continue;
      const km = haversineKm(pickup, { lat: profile.currentLat, lng: profile.currentLng });
      if (km < nearestKm) {
        nearestKm = km;
        nearest = profile;
      }
    }

    const createdAt = nowIso();
    const order: DemoOrder = {
      id: this.state.nextId.order++,
      customerId: customer.id,
      driverId: nearest?.userId ?? null,
      pickUpLat: pickup.lat,
      pickUpLng: pickup.lng,
      dropOffLat: dropoff.lat,
      dropOffLng: dropoff.lng,
      currentStage: nearest ? 'ASSIGNED' : 'CREATED',
      createdAt,
      flagged: false,
      flagReason: null,
      flaggedAt: null,
    };
    this.state.orders.push(order);

    if (nearest) {
      nearest.status = 'ONLINE_BUSY';
      nearest.lastUpdatedAt = createdAt;
      this.state.stageHistory.push({ orderId: order.id, fromStage: 'CREATED', toStage: 'ASSIGNED', changedAt: createdAt, actorId: null });
      const bot = this.state.bots[nearest.userId];
      if (bot) {
        bot.phase = 'toPickup';
        bot.orderId = order.id;
        bot.cruise = null;
      }
    }
    this.save();
    return this.toOrder(order);
  }

  listOrders(actorId: number): Order[] {
    this.sync();
    const actor = this.user(actorId);
    const byNewest = [...this.state.orders].sort((a, b) => b.id - a.id);
    const visible =
      actor.role === 'CUSTOMER'
        ? byNewest.filter((o) => o.customerId === actor.id)
        : actor.role === 'DRIVER'
          ? byNewest.filter((o) => o.driverId === actor.id)
          : byNewest.slice(0, 100);
    return visible.map((o) => this.toOrder(o));
  }

  getOrder(actorId: number, orderId: number): Order {
    this.sync();
    const actor = this.user(actorId);
    const order = this.order(orderId);
    if (order.customerId !== actor.id && order.driverId !== actor.id && actor.role !== 'DISPATCHER') {
      throw new ApiError(403, 'You are not allowed to view this order.');
    }
    return this.toOrder(order);
  }

  getHistory(actorId: number, orderId: number): OrderHistory {
    this.sync();
    const actor = this.user(actorId);
    const order = this.order(orderId);
    if (order.customerId !== actor.id && actor.role !== 'DISPATCHER') {
      throw new ApiError(403, "You are not allowed to view this order's history.");
    }
    return {
      order: this.toOrder(order),
      stages: this.state.stageHistory
        .filter((h) => h.orderId === orderId)
        .map((h) => ({ fromStage: h.fromStage, toStage: h.toStage, changedAt: h.changedAt, actorId: h.actorId })),
      route: this.state.locations
        .filter((l) => l.orderId === orderId)
        .map((l) => ({ lat: l.lat, lng: l.lng, recordedAt: l.recordedAt })),
    };
  }

  getLatestLocation(actorId: number, orderId: number): LocationUpdate | null {
    this.sync();
    const actor = this.user(actorId);
    const order = this.order(orderId);
    if (order.customerId !== actor.id && order.driverId !== actor.id && actor.role !== 'DISPATCHER') {
      throw new ApiError(403, "You are not allowed to view this order's location.");
    }
    const latest = this.state.latest[orderId];
    return latest ? this.broadcastPayload(order, latest) : null;
  }

  updateStage(actorId: number, orderId: number, requested: Stage): Order {
    this.sync();
    const actor = this.user(actorId);
    const order = this.order(orderId);
    const isDriver = order.driverId === actor.id;
    const isCustomer = order.customerId === actor.id;
    if (!isDriver && !isCustomer) throw new ApiError(403, 'You are not the driver assigned to this order.');
    if (!(requested in ALLOWED_TRANSITIONS)) {
      throw new ApiError(409, `Unknown stage: ${requested}`);
    }
    if (!isDriver && requested !== 'CANCELLED') {
      throw new ApiError(403, `Only the assigned driver can move this order to ${requested}.`);
    }
    if (!ALLOWED_TRANSITIONS[order.currentStage].includes(requested)) {
      throw new ApiError(409, `Cannot move order from ${order.currentStage} to ${requested}`);
    }

    this.state.stageHistory.push({ orderId, fromStage: order.currentStage, toStage: requested, changedAt: nowIso(), actorId: actor.id });
    order.currentStage = requested;

    if ((requested === 'DELIVERED' || requested === 'CANCELLED') && order.driverId != null) {
      const driverId = order.driverId;
      const bot = this.state.bots[driverId];
      if (bot && bot.orderId === orderId) {
        bot.phase = 'idle';
        bot.orderId = null;
      }
      if (!this.hasActiveOrder(driverId)) {
        const profile = this.profileOf(driverId);
        if (profile && profile.status === 'ONLINE_BUSY') {
          profile.status = 'ONLINE_AVAILABLE';
          profile.lastUpdatedAt = nowIso();
        }
      }
    }
    this.save();
    return this.toOrder(order);
  }

  // ---------------------------------------------------------------- drivers

  getProfile(actorId: number): DriverProfile {
    this.sync();
    const profile = this.profileOf(this.requireRole(actorId, 'DRIVER').id);
    if (!profile) throw new ApiError(403, 'You are not a driver');
    return this.toProfile(profile);
  }

  updateDriverStatus(actorId: number, status: DriverStatus, position?: LatLng): DriverProfile {
    this.sync();
    const driver = this.requireRole(actorId, 'DRIVER');
    const profile = this.profileOf(driver.id);
    if (!profile) throw new ApiError(403, 'You are not a driver');
    if (!['OFFLINE', 'ONLINE_AVAILABLE', 'ONLINE_BUSY'].includes(status)) throw new ApiError(400, `Unknown status: ${status}`);
    if (position && !isValidPosition(position)) throw new ApiError(400, 'Invalid latitude/longitude');

    profile.status = status === 'ONLINE_AVAILABLE' && this.hasActiveOrder(driver.id) ? 'ONLINE_BUSY' : status;
    if (position) {
      profile.currentLat = position.lat;
      profile.currentLng = position.lng;
    }
    profile.lastUpdatedAt = nowIso();
    this.save();
    return this.toProfile(profile);
  }

  /** DriverLocationService.saveLocation + LocationController broadcast. */
  saveLocation(actorId: number, orderId: number, position: LatLng) {
    this.sync();
    if (!isValidPosition(position)) throw new ApiError(400, 'Invalid latitude/longitude');
    const order = this.order(orderId);
    const actor = this.user(actorId);
    if (order.driverId !== actor.id) throw new ApiError(403, 'You are not the driver assigned to this order.');
    if (!ACTIVE_STAGES.includes(order.currentStage)) throw new ApiError(403, 'Order is not in an active stage.');

    this.state.latest[orderId] = { lat: position.lat, lng: position.lng };
    this.state.locations.push({ orderId, lat: position.lat, lng: position.lng, recordedAt: nowIso() });
    const points = this.state.locations.filter((l) => l.orderId === orderId);
    if (points.length > MAX_ROUTE_POINTS_PER_ORDER) {
      this.state.locations.splice(this.state.locations.indexOf(points[0]), 1);
    }
    if (this.state.locations.length > MAX_ROUTE_POINTS_TOTAL) {
      this.state.locations.splice(0, this.state.locations.length - MAX_ROUTE_POINTS_TOTAL);
    }
    const profile = this.profileOf(actor.id);
    if (profile) {
      profile.currentLat = position.lat;
      profile.currentLng = position.lng;
      profile.lastUpdatedAt = nowIso();
    }
    this.save();

    const update = this.broadcastPayload(order, position);
    this.emitLocal(orderId, update);
    this.channel?.postMessage({ orderId, update });
  }

  /** WebSocketDisconnectListener: a driver dropping off mid-order goes OFFLINE and their orders get flagged. */
  handleDisconnect(actorId: number) {
    this.sync();
    const actor = this.state.users.find((u) => u.id === actorId);
    if (!actor || actor.role !== 'DRIVER') return;
    const profile = this.profileOf(actor.id);
    if (profile) {
      profile.status = 'OFFLINE';
      profile.lastUpdatedAt = nowIso();
    }
    for (const order of this.state.orders) {
      if (order.driverId === actor.id && ACTIVE_STAGES.includes(order.currentStage)) {
        order.flagged = true;
        order.flagReason = 'Driver disconnected mid-order';
        order.flaggedAt = nowIso();
      }
    }
    this.save();
  }

  canSubscribe(actorId: number, orderId: number): boolean {
    this.sync();
    const order = this.state.orders.find((o) => o.id === orderId);
    return !!order && order.customerId === actorId;
  }

  onLocation(listener: LocationListener) {
    this.locationListeners.add(listener);
    return () => {
      this.locationListeners.delete(listener);
    };
  }

  private emitLocal(orderId: number, update: LocationUpdate) {
    for (const listener of this.locationListeners) {
      listener(orderId, update);
    }
  }

  private broadcastPayload(order: DemoOrder, position: LatLng): LocationUpdate {
    const target =
      order.currentStage === 'ASSIGNED' ? { lat: order.pickUpLat, lng: order.pickUpLng } : { lat: order.dropOffLat, lng: order.dropOffLng };
    const distance = haversineKm(target, position);
    return { lat: position.lat, lng: position.lng, eta: etaMinutes(distance), distance, timestamp: String(Math.floor(this.clock() / 1000)) };
  }

  // ---------------------------------------------------------------- dispatch

  overview(actorId: number): DispatchOverview {
    this.sync();
    this.requireRole(actorId, 'DISPATCHER');
    const orderByStage: DispatchOverview['orderByStage'] = {};
    for (const order of this.state.orders) {
      orderByStage[order.currentStage] = (orderByStage[order.currentStage] ?? 0) + 1;
    }
    const driverByStatus: DispatchOverview['driverByStatus'] = {};
    for (const profile of this.state.profiles) {
      driverByStatus[profile.status] = (driverByStatus[profile.status] ?? 0) + 1;
    }
    return {
      orderByStage,
      driverByStatus,
      flaggedOrders: this.state.orders
        .filter((o) => o.flagged)
        .map((o) => ({ orderId: o.id, reason: o.flagReason, flaggedAt: o.flaggedAt })),
    };
  }

  drivers(actorId: number): DriverProfile[] {
    this.sync();
    this.requireRole(actorId, 'DISPATCHER');
    return this.state.profiles.map((p) => this.toProfile(p));
  }

  /** Public, read-only fleet positions for the sign-in screen backdrop. */
  fleetSnapshot(): { id: number; position: LatLng; status: DriverStatus }[] {
    this.sync();
    return this.state.profiles
      .filter((p) => p.currentLat != null && p.currentLng != null)
      .map((p) => ({ id: p.userId, position: { lat: p.currentLat as number, lng: p.currentLng as number }, status: p.status }));
  }

  // ---------------------------------------------------------------- simulation

  /** Advances every simulated driver by one second. */
  tick() {
    this.sync();
    this.syncing = false;
    const now = this.clock();
    let changed = false;

    try {
      for (const [key, bot] of Object.entries(this.state.bots)) {
        const driverId = Number(key);
        const profile = this.profileOf(driverId);
        if (!profile || profile.currentLat == null || profile.currentLng == null) continue;
        const position = { lat: profile.currentLat, lng: profile.currentLng };
        const order = bot.orderId != null ? this.state.orders.find((o) => o.id === bot.orderId) : undefined;

        if (bot.phase !== 'idle' && (!order || !ACTIVE_STAGES.includes(order.currentStage))) {
          bot.phase = 'idle';
          bot.orderId = null;
          changed = true;
          continue;
        }

        switch (bot.phase) {
          case 'idle': {
            // Idle drivers drift around their patch of the city so the fleet map looks alive.
            if (profile.status !== 'ONLINE_AVAILABLE') break;
            if (!bot.cruise || haversineKm(position, bot.cruise) < 0.02) {
              const anchor = haversineKm(position, JAKARTA) > 6 ? JAKARTA : position;
              bot.cruise = { lat: anchor.lat + (Math.random() - 0.5) * 0.02, lng: anchor.lng + (Math.random() - 0.5) * 0.02 };
            }
            const next = stepTowards(position, bot.cruise, BOT_CRUISE_MPS);
            profile.currentLat = next.lat;
            profile.currentLng = next.lng;
            changed = true;
            break;
          }
          case 'toPickup':
          case 'toDropoff': {
            if (!order) break;
            const target =
              bot.phase === 'toPickup' ? { lat: order.pickUpLat, lng: order.pickUpLng } : { lat: order.dropOffLat, lng: order.dropOffLng };
            const next = stepTowards(position, target, BOT_SPEED_MPS);
            this.saveLocation(driverId, order.id, next);
            if (next.lat === target.lat && next.lng === target.lng) {
              bot.phase = bot.phase === 'toPickup' ? 'loading' : 'unloading';
              bot.waitUntil = now + 3000;
            }
            changed = true;
            break;
          }
          case 'loading': {
            if (!order || now < bot.waitUntil) break;
            if (order.currentStage === 'ASSIGNED') this.updateStage(driverId, order.id, 'PICKED_UP');
            if (order.currentStage === 'PICKED_UP') this.updateStage(driverId, order.id, 'ON_THE_WAY');
            bot.phase = 'toDropoff';
            changed = true;
            break;
          }
          case 'unloading': {
            if (!order || now < bot.waitUntil) break;
            if (order.currentStage === 'ON_THE_WAY') this.updateStage(driverId, order.id, 'DELIVERED');
            bot.phase = 'idle';
            bot.orderId = null;
            changed = true;
            break;
          }
        }
      }
    } finally {
      this.syncing = true;
    }

    if (changed) {
      this.save();
    }
  }
}
