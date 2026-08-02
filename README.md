# Waypoint

Real-time fleet and delivery tracking backend — the same core problem behind ride-hailing / food-delivery
apps: show a customer exactly where their driver is, live, on a map, without leaking one customer's
data to another. Backend-only portfolio project (Spring Boot + WebSocket/STOMP + PostgreSQL + Redis).

**Status: not deployed yet.** The app is deploy-ready (Dockerfile, `render.yaml` blueprint, `/actuator/health`
check, all config env-var driven) but hasn't gone live — the card needed to provision a managed
Postgres/Redis instance on the hosting side has been the blocker, not the code. See
[Deployment](#deployment) below.

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Data Model](#data-model)
- [API](#api)
- [Running Locally](#running-locally)
- [Running Tests](#running-tests)
- [Driver Simulator](#driver-simulator)
- [CI/CD](#cicd)
- [Deployment](#deployment)
- [Trade-offs & Design Decisions](#trade-offs--design-decisions)
- [Known Limitations](#known-limitations)

## Architecture

```
Customer Client              Driver Client
  |  HTTPS (REST)               |  HTTPS (REST)
  |  WS/STOMP (subscribe)       |  WS/STOMP (publish location)
  v                             v
+----------------------------------------------------+
|                Spring Boot App (Waypoint API)        |
|  Controller layer  -> REST + STOMP message mappings   |
|  Service layer      -> state machine, matching, ETA,  |
|                         authorization                 |
|  Repository layer   -> Spring Data JPA                |
+----------------------------------------------------+
        |                              |
        v                              v
  PostgreSQL                        Redis
  (system of record:            (fast-changing state:
   users, orders,                 latest driver location,
   stage history,                 rate-limit counters,
   location history)              dispatch-overview cache)
```

- **REST** handles auth, order creation, order/driver status changes, and the dispatcher overview.
- **WebSocket (STOMP)** handles the real-time path: drivers publish location to
  `/app/location/{orderId}`, the server broadcasts position + ETA to `/topic/order/{orderId}`, and only
  the customer who owns that order is authorized to subscribe to it.
- **PostgreSQL** is the durable system of record — users, orders, stage-transition audit trail, and the
  full location-history log (written asynchronously so it never blocks the live broadcast path).
- **Redis** holds everything that's cheap to lose and expensive to keep hitting Postgres for: the
  latest-known driver location per order, login/order-creation rate-limit counters, and a short-TTL
  cache for the dispatcher overview.

### Auth

JWT issued on login, carried in an **httpOnly cookie** (not a header) so it can't be read or exfiltrated
by injected JS. The same cookie authenticates both REST requests and the WebSocket handshake — a
`HandshakeInterceptor` reads it off the real HTTP upgrade request (the only place it's actually present;
STOMP frames themselves never carry it) and a `ChannelInterceptor` re-attaches the resolved identity to
each STOMP frame afterward.

Every protected endpoint is guarded by role (`hasRole(...)`) *and*, where it matters, ownership — a
driver can only advance/ping an order they're assigned to, a customer can only subscribe to their own
order's topic.

## Tech Stack

- **Java 17**, Spring Boot 3.5 (Web, WebSocket, Security, Data JPA, Data Redis, Validation, Actuator)
- **PostgreSQL 16**, **Redis 7**
- **JWT** (jjwt), BCrypt password hashing
- **JUnit 5 + Mockito** (unit tests), **Testcontainers** (real Postgres/Redis integration tests)
- **springdoc-openapi** (Swagger UI)
- **Checkstyle** (lint), **GitHub Actions** (CI)
- **Docker** multi-stage build, **Docker Compose** for local dev

## Data Model

| Entity | Key fields | Notes |
|---|---|---|
| `UserEntity` | id, name, email, passwordHash, role | role ∈ {CUSTOMER, DRIVER, DISPATCHER} |
| `DriverProfileEntity` | id, userId, status, currentLat, currentLng, lastUpdatedAt | status ∈ {OFFLINE, ONLINE_AVAILABLE, ONLINE_BUSY} |
| `OrderEntity` | id, customerId, driverId, pickUp/dropOff lat+lng, currentStage, flagged | drives the state machine |
| `OrderStageHistoryEntity` | id, orderId, fromStage, toStage, changedAt, actorId | audit trail of every transition |
| `LocationHistoryEntity` | id, orderId, lat, lng, recordedAt | append-only, written asynchronously |

Order state machine: `CREATED → ASSIGNED → PICKED_UP → ON_THE_WAY → DELIVERED`, with `CANCELLED`
reachable only from `CREATED` or `ASSIGNED`. Enforced via an explicit allowed-transitions map, not
scattered if-checks.

## API

Full interactive docs (once the app is running): **`/swagger-ui/index.html`**.

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register as customer or driver (dispatcher accounts can't self-register) |
| POST | `/api/auth/login` | Public | Authenticate, sets the `token` cookie |
| POST | `/api/orders` | Customer | Create an order; triggers nearest-driver matching |
| PATCH | `/api/orders/{id}/status` | Driver (assigned) | Advance the order to its next stage |
| PATCH | `/api/drivers/me/status` | Driver | Toggle online/available/offline, optionally report location |
| GET | `/api/dispatch/overview` | Dispatcher | Cached counts by stage/status + flagged orders |
| GET | `/actuator/health` | Public | Health check |

STOMP:

| Direction | Destination | Purpose |
|---|---|---|
| Client → Server | `/app/location/{orderId}` | Driver publishes a location ping |
| Server → Client | `/topic/order/{orderId}` | Broadcast of latest location + ETA, owning customer only |

## Running Locally

**Prerequisites:** Docker + Docker Compose, and ports `5432`, `6379`, `8080` free on your machine. If
`docker compose up` fails with "port is already allocated", something else (another Postgres/Redis
instance, an old container) is holding one of those ports — `docker ps` to find it, then either stop it
or free the port before retrying.

```bash
cd App
cp .env.example .env   # fill in JWT_SECRET_KEY at minimum
docker compose up -d --build
```

The app comes up on `http://localhost:8080`. Check it's healthy:

```bash
curl http://localhost:8080/actuator/health
```

Try it:

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123","role":"CUSTOMER"}'
```

Or just open `http://localhost:8080/swagger-ui/index.html` and use "Try it out" (login first — the
cookie it sets is then reused by every other request from the same browser session).

### Running natively (without Docker Compose)

Point `.env` at your own Postgres/Redis instances (see `App/.env.example`), then:

```bash
cd App
./mvnw spring-boot:run
```

## Running Tests

```bash
cd App
./mvnw test               # everything — unit + integration (needs Docker running)
./mvnw test -Dtest=OrderServiceTest,GeoLocationHelperTest   # unit tests only, no Docker needed
```

Integration tests spin up their own throwaway Postgres/Redis via Testcontainers — they don't touch
whatever's running in `docker-compose.yml`.

## Driver Simulator

A small Node script (`simulator/`) logs in as a driver and publishes a smooth, interpolated trajectory
between two coordinates over STOMP — for demoing live tracking without a real GPS device.

```bash
cd simulator
npm install
node driver-simulator.js \
  --email=driver@example.com --password=password123 \
  --orderId=1 \
  --fromLat=-6.2088 --fromLng=106.8456 \
  --toLat=-6.1751 --toLng=106.8650
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): **lint → test → build → deploy**, each stage gated on the
previous one succeeding (a failing test blocks the build stage from ever running).

- **lint** — Checkstyle (unused imports, equals/hashCode, empty catch blocks — intentionally not a
  strict formatting ruleset; the codebase never adopted one, so enforcing one now would fail on style,
  not substance).
- **test** — full suite, including the Testcontainers integration tests (GitHub's `ubuntu-latest`
  runners have Docker preinstalled, no extra setup needed).
- **build** — builds the actual multi-stage `Dockerfile`, the same one used for deployment.
- **deploy** — currently a placeholder that only runs on `main`. See below.

## Deployment

**Not live yet.** Everything on the code side is ready:

- Multi-stage `Dockerfile`, runs as a non-root user.
- `render.yaml` blueprint targeting Render, `App/Dockerfile` as the build.
- `server.port` respects Render's injected `$PORT` instead of a hardcoded value.
- `/actuator/health` for Render's health check.
- Every secret/connection value is env-var driven, nothing hardcoded (see `App/.env.example`).

What's actually blocking it: provisioning a managed Postgres + Redis instance for the deployed
environment needs a payment method on file (even free tiers on Render/Neon/Upstash generally ask for
card verification), and a card issue has made that step unavailable for now. The app has been fully
verified end-to-end locally via `docker compose up` — register → login → create order → nearest-driver
match → live location broadcast → stage transitions — all confirmed working; going live is a
provisioning/billing blocker, not an unverified-code one.

## Trade-offs & Design Decisions

- **Redis for ephemeral state, Postgres for durable state.** A driver's live location changes every few
  seconds and is only ever needed at its latest value — writing that to Postgres on every ping would be
  wasteful. Redis holds the latest value; the full history is still durably logged to Postgres, just
  asynchronously, off the critical broadcast path.
- **Cookie-based JWT, not Authorization headers.** httpOnly cookies can't be read by injected/malicious
  JS, which closes off a whole class of XSS-driven token theft that a `localStorage`-held bearer token
  is exposed to. The cost: it needs a `HandshakeInterceptor` to read it at the WebSocket layer (STOMP
  frames don't carry cookies) and explicit CORS/SameSite handling if a separately-hosted frontend is
  ever added back.
- **Raw WebSocket endpoint (`/ws/websocket`) for non-browser clients.** The driver simulator and any
  future headless client connect directly to the raw endpoint instead of negotiating through SockJS —
  simpler, and avoids SockJS's XHR-transport CORS/credentials quirks entirely for those clients.
- **`ddl-auto: update` instead of a migration tool (Flyway/Liquibase).** Faster to iterate through a
  daily build-and-fix cycle; the known cost is schema drift risk and no rollback story, acceptable for a
  single-developer portfolio project but the first thing to replace before this became a real product.
- **Fixed-window rate limiting, not a sliding window or token bucket.** A Redis `INCR` + `EXPIRE` pair is
  simple and cheap, at the cost of allowing a burst right at the window boundary (e.g. two windows'
  worth of requests clustered around the reset). Acceptable for abuse-resistance at this scale; a token
  bucket would be the next step if this needed to be airtight.
- **Nearest-driver matching runs synchronously inside the order-creation request**, scanning all
  `ONLINE_AVAILABLE` drivers with a known location. Simple and correct at demo scale (dozens of
  drivers); would need to move to a spatial index (e.g. Redis geo commands) or a background matcher if
  the driver pool ever got large.
- **Single-instance WebSocket broker (Spring's built-in `SimpleBrokerMessageHandler`).** Documented but
  not implemented: horizontally scaling this would need an external broker (RabbitMQ, or Redis pub/sub)
  so a broadcast reaches a subscriber connected to a *different* app instance — out of scope for a
  single-region portfolio deployment.

## Known Limitations

- No `GET /orders` or `GET /orders/{id}` endpoint yet — a client can only know about orders it just
  created in the same session; there's no way to look up or list past orders. Out of MVP scope.
- No "my assigned orders" endpoint for drivers — a driver needs to be told their order ID out-of-band
  (by the customer/dispatcher) rather than discovering it themselves.
- No `/logout` endpoint — since the JWT is stateless, "logging out" client-side can't invalidate the
  cookie server-side; it just expires on its own (2h TTL).
- Admin manual reassignment for stuck/flagged orders isn't built — flagged orders are visible on the
  dispatcher overview, but resolving them is a manual DB operation for now.
