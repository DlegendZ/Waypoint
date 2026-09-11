import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../client';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DemoEngine } from './engine';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

function expectApiError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    return;
  }
  throw new Error(`expected ApiError ${status}`);
}

describe('DemoEngine', () => {
  let time: number;
  let engine: DemoEngine;
  let customerId: number;
  let driverId: number;
  let dispatcherId: number;

  beforeEach(() => {
    time = Date.parse('2026-09-11T08:00:00Z');
    engine = new DemoEngine(new MemoryStorage(), () => time);
    customerId = engine.login(DEMO_ACCOUNTS.customer, DEMO_PASSWORD).id;
    driverId = engine.login(DEMO_ACCOUNTS.driver, DEMO_PASSWORD).id;
    dispatcherId = engine.login(DEMO_ACCOUNTS.dispatcher, DEMO_PASSWORD).id;
  });

  // Simulated drivers can't be toggled through the API, so switch them off in the stored state directly.
  const takeBotsOffline = () => {
    const internals = engine as unknown as { state: { profiles: { userId: number; status: string }[] }; save(): void };
    for (const profile of internals.state.profiles) {
      if (profile.userId !== driverId) profile.status = 'OFFLINE';
    }
    internals.save();
  };

  it('rejects wrong passwords with the same message the server uses', () => {
    expectApiError(() => engine.login(DEMO_ACCOUNTS.customer, 'nope'), 401);
  });

  it('refuses dispatcher self-registration and duplicate emails', () => {
    expectApiError(() => engine.register({ name: 'X', email: 'x@y.z', password: 'password123', role: 'DISPATCHER' as never }), 400);
    expectApiError(() => engine.register({ name: 'X', email: DEMO_ACCOUNTS.customer, password: 'password123', role: 'CUSTOMER' }), 409);
    expectApiError(() => engine.register({ name: 'X', email: 'short@y.z', password: 'short', role: 'CUSTOMER' }), 400);
  });

  it('matches the nearest available driver and marks them busy', () => {
    takeBotsOffline();
    engine.updateDriverStatus(driverId, 'ONLINE_AVAILABLE', { lat: -6.2, lng: 106.8 });

    const order = engine.createOrder(customerId, { pickUpLat: -6.2001, pickUpLng: 106.8001, dropOffLat: -6.18, dropOffLng: 106.82 });

    expect(order.currentStage).toBe('ASSIGNED');
    expect(order.driverId).toBe(driverId);
    expect(engine.getProfile(driverId).status).toBe('ONLINE_BUSY');
  });

  it('leaves the order in CREATED when nobody is available', () => {
    takeBotsOffline();
    const order = engine.createOrder(customerId, { pickUpLat: -6.2, pickUpLng: 106.8, dropOffLat: -6.18, dropOffLng: 106.82 });
    expect(order.currentStage).toBe('CREATED');
    expect(order.driverId).toBeNull();
  });

  it('enforces the state machine and frees the driver on delivery', () => {
    takeBotsOffline();
    engine.updateDriverStatus(driverId, 'ONLINE_AVAILABLE', { lat: -6.2, lng: 106.8 });
    const order = engine.createOrder(customerId, { pickUpLat: -6.2, pickUpLng: 106.8, dropOffLat: -6.18, dropOffLng: 106.82 });

    expectApiError(() => engine.updateStage(driverId, order.id, 'DELIVERED'), 409);
    expectApiError(() => engine.updateStage(customerId, order.id, 'PICKED_UP'), 403);

    engine.updateStage(driverId, order.id, 'PICKED_UP');
    expectApiError(() => engine.updateStage(driverId, order.id, 'CANCELLED'), 409);
    engine.updateStage(driverId, order.id, 'ON_THE_WAY');
    engine.updateStage(driverId, order.id, 'DELIVERED');

    expect(engine.getProfile(driverId).status).toBe('ONLINE_AVAILABLE');
    expect(engine.getHistory(customerId, order.id).stages.map((s) => s.toStage)).toEqual(['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED']);
  });

  it('lets the owning customer cancel, and hides orders from other customers', () => {
    const stranger = engine.register({ name: 'Other', email: 'other@x.io', password: 'password123', role: 'CUSTOMER' });
    const order = engine.createOrder(customerId, { pickUpLat: -6.2, pickUpLng: 106.8, dropOffLat: -6.18, dropOffLng: 106.82 });

    expectApiError(() => engine.getOrder(stranger.id, order.id), 403);
    expectApiError(() => engine.getHistory(stranger.id, order.id), 403);
    expect(engine.canSubscribe(stranger.id, order.id)).toBe(false);
    expect(engine.listOrders(stranger.id)).toEqual([]);

    expect(engine.updateStage(customerId, order.id, 'CANCELLED').currentStage).toBe('CANCELLED');
  });

  it('broadcasts pings with a straight-line ETA and rejects drivers who are not assigned', () => {
    takeBotsOffline();
    engine.updateDriverStatus(driverId, 'ONLINE_AVAILABLE', { lat: -6.2, lng: 106.8 });
    const order = engine.createOrder(customerId, { pickUpLat: -6.2, pickUpLng: 106.8, dropOffLat: -6.18, dropOffLng: 106.82 });
    const updates: number[] = [];
    engine.onLocation((id, update) => {
      if (id === order.id) updates.push(update.eta);
    });

    // ~11.1 km north of the pick-up at 40 km/h ≈ 17 min.
    engine.saveLocation(driverId, order.id, { lat: -6.1, lng: 106.8 });
    expect(updates).toEqual([17]);
    expect(engine.getLatestLocation(customerId, order.id)?.lat).toBe(-6.1);

    const intruder = engine.register({ name: 'Intruder', email: 'intruder@x.io', password: 'password123', role: 'DRIVER' });
    expectApiError(() => engine.saveLocation(intruder.id, order.id, { lat: 0, lng: 0 }), 403);
  });

  it('keeps a driver with an open order busy even when they ask to be available', () => {
    takeBotsOffline();
    engine.updateDriverStatus(driverId, 'ONLINE_AVAILABLE', { lat: -6.2, lng: 106.8 });
    const order = engine.createOrder(customerId, { pickUpLat: -6.2, pickUpLng: 106.8, dropOffLat: -6.18, dropOffLng: 106.82 });

    engine.handleDisconnect(driverId);
    expect(engine.getOrder(dispatcherId, order.id).flagged).toBe(true);
    expect(engine.getProfile(driverId).status).toBe('OFFLINE');

    expect(engine.updateDriverStatus(driverId, 'ONLINE_AVAILABLE').status).toBe('ONLINE_BUSY');
  });

  it('simulated drivers carry an order all the way to delivered', () => {
    const order = engine.createOrder(customerId, { pickUpLat: -6.19, pickUpLng: 106.83, dropOffLat: -6.2, dropOffLng: 106.84 });
    expect(order.currentStage).toBe('ASSIGNED');

    for (let second = 0; second < 600; second++) {
      time += 1000;
      engine.tick();
      if (engine.getOrder(customerId, order.id).currentStage === 'DELIVERED') break;
    }

    expect(engine.getOrder(customerId, order.id).currentStage).toBe('DELIVERED');
    expect(engine.getHistory(customerId, order.id).route.length).toBeGreaterThan(3);
    const bot = engine.drivers(dispatcherId).find((d) => d.userId === order.driverId)!;
    expect(bot.status).toBe('ONLINE_AVAILABLE');
  });

  it('dispatcher overview counts orders by stage and drivers by status', () => {
    const overview = engine.overview(dispatcherId);
    expect(overview.orderByStage.DELIVERED).toBe(1);
    expect(overview.driverByStatus.ONLINE_AVAILABLE).toBe(6);
    expect(overview.driverByStatus.OFFLINE).toBe(1);
    expectApiError(() => engine.overview(customerId), 403);
  });
});
