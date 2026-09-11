import { ApiError, type RealtimeConnection, type WaypointApi } from './client';
import { StompRealtime } from './stomp';
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

const FALLBACK_MESSAGES: Record<number, string> = {
  401: 'Your session has ended. Sign in again.',
  403: "Your account doesn't have access to that.",
  404: "That doesn't exist (or no longer exists).",
  500: 'The server ran into an error. Try again in a moment.',
  502: 'The server is unreachable right now. Try again in a moment.',
  503: 'The server is starting up or unavailable. Try again in a moment.',
};

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** When false, a 401 is a normal answer (wrong password, signed out) rather than an expired session. */
  sessionRequired?: boolean;
}

/** Talks to the Spring Boot backend. Auth rides on the httpOnly "token" cookie, so every call sends credentials. */
export class HttpApi implements WaypointApi {
  readonly mode = 'live' as const;

  /**
   * @param baseUrl "" for same-origin (dev proxy) or e.g. "https://waypoint-api.onrender.com".
   * @param onSessionExpired called when an authenticated call comes back 401.
   */
  constructor(
    private readonly baseUrl: string,
    private readonly onSessionExpired: () => void,
  ) {}

  get target(): string {
    return this.baseUrl || window.location.origin;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, sessionRequired = true } = options;
    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, {
        method,
        credentials: 'include',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, `Can't reach the Waypoint server at ${this.target}. Check that it's running and try again.`);
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      if (response.status === 401 && sessionRequired) {
        this.onSessionExpired();
      }
      const serverMessage =
        data && typeof data === 'object' && 'message' in data && typeof data.message === 'string' ? data.message : null;
      let message = serverMessage ?? FALLBACK_MESSAGES[response.status] ?? `Request failed (${response.status}).`;
      if (response.status === 429 && !serverMessage) {
        const retryAfter = response.headers.get('Retry-After');
        message = `Too many requests. Try again in ${retryAfter ?? 'a few'} seconds.`;
      }
      throw new ApiError(response.status, message);
    }

    return data as T;
  }

  register(request: RegisterRequest) {
    return this.request<User>('/api/auth/register', { method: 'POST', body: request, sessionRequired: false });
  }

  login(email: string, password: string) {
    return this.request<User>('/api/auth/login', { method: 'POST', body: { email, password }, sessionRequired: false });
  }

  async logout() {
    await this.request<void>('/api/auth/logout', { method: 'POST', sessionRequired: false });
  }

  async me() {
    try {
      return await this.request<User>('/api/auth/me', { sessionRequired: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
  }

  createOrder(request: CreateOrderRequest) {
    return this.request<Order>('/api/orders', { method: 'POST', body: request });
  }

  listOrders() {
    return this.request<Order[]>('/api/orders');
  }

  getOrder(orderId: number) {
    return this.request<Order>(`/api/orders/${orderId}`);
  }

  getHistory(orderId: number) {
    return this.request<OrderHistory>(`/api/orders/${orderId}/history`);
  }

  async getLatestLocation(orderId: number) {
    try {
      return await this.request<LocationUpdate>(`/api/orders/${orderId}/location`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  updateOrderStage(orderId: number, stage: Stage) {
    return this.request<Order>(`/api/orders/${orderId}/status`, { method: 'PATCH', body: { updatedStage: stage } });
  }

  getDriverProfile() {
    return this.request<DriverProfile>('/api/drivers/me');
  }

  updateDriverStatus(status: DriverStatus, position?: LatLng) {
    return this.request<DriverProfile>('/api/drivers/me/status', {
      method: 'PATCH',
      body: position ? { updatedStatus: status, lat: position.lat, lng: position.lng } : { updatedStatus: status },
    });
  }

  getOverview() {
    return this.request<DispatchOverview>('/api/dispatch/overview');
  }

  listDrivers() {
    return this.request<DriverProfile[]>('/api/dispatch/drivers');
  }

  openRealtime(): RealtimeConnection {
    return new StompRealtime(websocketUrl(this.baseUrl));
  }
}

/** Raw WebSocket endpoint that Spring's SockJS registration exposes at /ws/websocket. */
export function websocketUrl(baseUrl: string): string {
  if (!baseUrl) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/websocket`;
  }
  return `${baseUrl.replace(/^http/, 'ws')}/ws/websocket`;
}
