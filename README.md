# Waypoint

Real-time fleet and delivery tracking. It tackles the same core problem as ride-hailing and food-delivery
apps: showing a customer exactly where their driver is, live on a map, without leaking one customer's data
to another.

- **Backend:** Spring Boot + WebSocket/STOMP + PostgreSQL + Redis (`App/`)
- **Web app:** React + TypeScript + Leaflet, one client with three role-based screens: customer, driver
  and dispatcher (`web/`)

**Live web app:** https://dlegendz.github.io/Waypoint/ (live once the GitHub Pages workflow has run; see
[Deploying the web app](#deploying-the-web-app-github-pages)).

The public site runs in **demo mode**. A copy of the backend's rules runs in the visitor's browser, with
simulated drivers, so anyone can click the link and use the app with nothing deployed server-side. Point
it at a deployed API and the same build talks to the real backend (see
[Connecting the web app to a deployed API](#connecting-the-web-app-to-a-deployed-api)).

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Web App](#web-app)
- [Data Model](#data-model)
- [API](#api)
- [Configuration](#configuration)
- [Running Locally](#running-locally)
- [Running Tests](#running-tests)
- [Driver Simulator](#driver-simulator)
- [CI/CD](#cicd)
- [Deploying the web app (GitHub Pages)](#deploying-the-web-app-github-pages)
- [Deploying the backend](#deploying-the-backend)
- [Connecting the web app to a deployed API](#connecting-the-web-app-to-a-deployed-api)
- [Trade-offs & Design Decisions](#trade-offs--design-decisions)
- [Changelog](#changelog)
- [Known Limitations](#known-limitations)

## Architecture

```
                 Web app (web/, static — GitHub Pages or `npm run dev`)
          Customer screen      Driver screen        Dispatcher screen
                |                    |                      |
   HTTPS (REST, cookie auth)   WS/STOMP (publish)    HTTPS (REST, polling)
   WS/STOMP (subscribe)        HTTPS (REST)                 |
                v                    v                      v
+----------------------------------------------------------------+
|              Spring Boot App (Waypoint API, App/)                |
|  Controller layer  -> REST + STOMP message mappings              |
|  Service layer     -> state machine, matching, ETA, authz        |
|  Repository layer  -> Spring Data JPA                            |
+----------------------------------------------------------------+
        |                              |
        v                              v
  PostgreSQL                        Redis
  (system of record:            (fast-changing state:
   users, orders,                 latest driver location,
   stage history,                 rate-limit counters,
   location history)              dispatch-overview cache)
```

- **REST** handles auth, order creation and lookup, order/driver status changes, history, and the
  dispatcher views.
- **WebSocket (STOMP)** handles the real-time path: drivers publish their location to
  `/app/location/{orderId}`, and the server broadcasts position + ETA to `/topic/order/{orderId}`. Only the
  customer who owns that order is authorized to subscribe to it.
- **PostgreSQL** is the durable system of record: users, orders, the stage-transition audit trail, and the
  full location-history log. History is written asynchronously so it never blocks the live broadcast path.
- **Redis** holds everything that's cheap to lose and expensive to keep hitting Postgres for: the
  latest-known driver location per order, login/order-creation rate-limit counters, and a short-TTL cache
  for the dispatcher overview.

### Auth

A JWT is issued on login and carried in an **httpOnly cookie**, not a header, so injected JS can't read or
exfiltrate it. The same cookie authenticates both REST requests and the WebSocket handshake. A
`HandshakeInterceptor` reads it off the real HTTP upgrade request, which is the only place it's actually
present (STOMP frames never carry it). A `ChannelInterceptor` then re-attaches the resolved identity to
each STOMP frame.

Every protected endpoint is guarded by role (`hasRole(...)`) *and*, where it matters, by ownership. A
driver can only advance or ping an order they're assigned to. A customer can only read, cancel, or
subscribe to their own orders. A request with no cookie (or an expired one) gets **401**; a signed-in user
who isn't allowed gets **403**.

## Tech Stack

**Backend**
- **Java 17**, Spring Boot 3.5 (Web, WebSocket, Security, Data JPA, Data Redis, Validation, Actuator)
- **PostgreSQL 16**, **Redis 7**
- **JWT** (jjwt), BCrypt password hashing
- **JUnit 5 + Mockito** (unit tests), **Testcontainers** (real Postgres/Redis integration tests)
- **springdoc-openapi** (Swagger UI)
- **Checkstyle** (lint), **GitHub Actions** (CI)
- **Docker** multi-stage build, **Docker Compose** for local dev

**Web app**
- **React 18 + TypeScript**, built with **Vite**
- **Leaflet** with OpenStreetMap tiles (no API key needed)
- **@stomp/stompjs** over a plain WebSocket to `/ws/websocket`
- **Vitest** unit tests
- Deployed as a static site to **GitHub Pages** by GitHub Actions

## Web App

One web client; what you see depends on the account's role.

| Screen | What it does |
|---|---|
| **Sign in / Create account** | Register as a customer or a driver (dispatchers are created by an admin, see [Configuration](#configuration)). In demo mode, one click signs in as any of the three demo accounts. |
| **Customer** | Click the map to set a pick-up and a drop-off, then request a delivery. You're matched with the nearest available driver. Track them live: the driver's marker moves, the ETA counts down, and the stage strip shows *Placed → Driver assigned → Picked up → On the way → Delivered*. You can cancel before pick-up. Finished deliveries show the route the driver actually took. |
| **Driver** | Set your position (click the map or use device location), then go online. New assignments pop up automatically. Drive to the pick-up and drop-off, either for real (clicking the map sends a location ping) or with the built-in **simulated drive**, which streams pings every 2 s. Advance the order with *Confirm pick-up → Start the trip → Confirm delivery*. Going offline or closing the tab mid-delivery flags the order for the dispatcher, just as the backend's disconnect detection does. |
| **Dispatcher** | Fleet board showing how many orders sit at each stage, available/busy/offline drivers, and orders flagged for attention. Every driver appears on one map. Filter all orders and open any of them to see its stage timeline (who moved it, and when) and its recorded route. |

**Demo mode.** With no backend configured, the app runs `web/src/api/demo/`, an in-browser stand-in that
applies the same rules as the Spring services: the state machine, nearest-driver matching, ownership
checks, the straight-line ETA and disconnect flagging. Six simulated drivers cruise around central Jakarta
and take orders on their own. Data lives only in the visitor's browser (`localStorage`), and each tab has
its own sign-in. That means you can be the customer in one tab and the driver in another and watch your own
pings arrive live. Demo accounts (password `password123`):

| Role | Email |
|---|---|
| Customer | `customer@waypoint.demo` |
| Driver | `driver@waypoint.demo` |
| Dispatcher | `dispatcher@waypoint.demo` |

The **Demo data / Live server** chip in the top bar (or **Change** on the sign-in screen) switches the page
between demo mode and any Waypoint server URL, and can erase the demo data.

## Data Model

| Entity | Key fields | Notes |
|---|---|---|
| `UserEntity` | id, name, email, passwordHash, role | role ∈ {CUSTOMER, DRIVER, DISPATCHER} |
| `DriverProfileEntity` | id, userId, status, currentLat, currentLng, lastUpdatedAt | status ∈ {OFFLINE, ONLINE_AVAILABLE, ONLINE_BUSY} |
| `OrderEntity` | id, customerId, driverId, pickUp/dropOff lat+lng, currentStage, flagged | drives the state machine |
| `OrderStageHistoryEntity` | id, orderId, fromStage, toStage, changedAt, actorId | audit trail of every transition (actorId null = automatic) |
| `LocationHistoryEntity` | id, orderId, lat, lng, recordedAt | append-only, written asynchronously |

The order state machine is `CREATED → ASSIGNED → PICKED_UP → ON_THE_WAY → DELIVERED`, with `CANCELLED`
reachable only from `CREATED` or `ASSIGNED`. It's enforced through an explicit allowed-transitions map, not
scattered if-checks. When an order reaches `DELIVERED` or `CANCELLED`, its driver goes from busy back to
available.

## API

Full interactive docs (once the app is running): **`/swagger-ui/index.html`**.

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register as customer or driver (dispatcher accounts can't self-register) |
| POST | `/api/auth/login` | Public | Authenticate, sets the `token` cookie |
| POST | `/api/auth/logout` | Public | Clears the `token` cookie |
| GET | `/api/auth/me` | Signed in | The current user (401 when signed out) |
| POST | `/api/orders` | Customer | Create an order; triggers nearest-driver matching |
| GET | `/api/orders` | Signed in | Customer: own orders. Driver: orders assigned to them. Dispatcher: 100 most recent |
| GET | `/api/orders/{id}` | Owner, assigned driver, dispatcher | One order with its current stage |
| GET | `/api/orders/{id}/history` | Owner, dispatcher | Stage timeline + recorded route |
| GET | `/api/orders/{id}/location` | Owner, assigned driver, dispatcher | Latest driver position + ETA from Redis (404 before the first ping) |
| PATCH | `/api/orders/{id}/status` | Assigned driver (any valid move), owner (cancel only) | Move the order to its next stage |
| GET | `/api/drivers/me` | Driver | Own status and last known position |
| PATCH | `/api/drivers/me/status` | Driver | Go online/offline; optional `lat`/`lng` reports current position for matching |
| GET | `/api/dispatch/overview` | Dispatcher | Cached counts by stage/status + flagged orders |
| GET | `/api/dispatch/drivers` | Dispatcher | Every driver with status and last known position |
| GET | `/actuator/health` | Public | Health check |

STOMP (raw WebSocket endpoint `/ws/websocket`; SockJS at `/ws`):

| Direction | Destination | Purpose |
|---|---|---|
| Client → Server | `/app/location/{orderId}` | Driver publishes a location ping |
| Server → Client | `/topic/order/{orderId}` | Broadcast of latest location + ETA, owning customer only |

## Configuration

All backend configuration comes from environment variables (see `App/.env.example`).

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` | — | PostgreSQL connection (`jdbc:postgresql://…`) |
| `REDIS_HOST`, `REDIS_PORT` | `localhost`, `6379` | Redis connection |
| `JWT_SECRET_KEY`, `JWT_EXPIRATION_TIME` | — | Signing key (32+ chars) and token lifetime in ms |
| `COOKIE_SECURE` | `false` | Set `true` when served over HTTPS |
| `COOKIE_SAME_SITE` | `Lax` | Use `None` (with `COOKIE_SECURE=true`) when the web app is on a different site than the API |
| `CORS_ALLOWED_ORIGINS` | *(empty)* | Comma-separated browser origins allowed to call the API, e.g. `https://dlegendz.github.io`. Empty = no cross-origin access (same-origin/proxy only) |
| `DISPATCHER_EMAIL`, `DISPATCHER_PASSWORD`, `DISPATCHER_NAME` | *(empty)*, *(empty)*, `Dispatcher` | If both email and password are set, a dispatcher account is created on startup (when missing) |

The web app reads one build-time variable, `VITE_API_URL`: `demo` or empty for the in-browser demo, `/`
for the same origin (the dev proxy), or a full URL such as `https://waypoint-api.onrender.com`.

## Running Locally

**Prerequisites:** Docker + Docker Compose and Node.js 20+. Ports `5432`, `6379`, `8080` and `5173` must
be free. If `docker compose up` fails with "port is already allocated", something else (another
Postgres/Redis instance, an old container) is holding one of those ports. Run `docker ps` to find it,
then stop it or free the port before retrying.

**1. Backend**

```bash
cd App
cp .env.example .env   # fill in JWT_SECRET_KEY at minimum; set DISPATCHER_EMAIL/PASSWORD for a dispatcher login
docker compose up -d --build
```

The API comes up on `http://localhost:8080`. Check it's healthy:

```bash
curl http://localhost:8080/actuator/health
```

**2. Web app**

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` and `/ws` to `localhost:8080`, so the auth
cookie stays same-origin and no CORS setup is needed locally. To point the proxy at another backend, set
`WAYPOINT_BACKEND=http://host:port` before `npm run dev`.

To work on the UI without the backend running, start it in demo mode:

```bash
npm run dev -- --mode demo
```

You can also drive the API directly with `http://localhost:8080/swagger-ui/index.html` ("Try it out";
log in first, and the cookie it sets is reused by every other request).

### Running the backend natively (without Docker Compose)

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

Integration tests spin up their own throwaway Postgres/Redis via Testcontainers; they don't touch
whatever's running in `docker-compose.yml`. `OrderLifecycleIntegrationTest` walks the whole REST flow the
web app relies on: position report → match → ownership-checked reads → stages → history → dispatcher views
→ `/me` and logout.

```bash
cd web
npm test                  # Vitest: demo engine rules + geo/ETA/time helpers
npm run build             # type-check + production build
```

## Driver Simulator

A small Node script (`simulator/`) logs in as a driver and publishes a smooth, interpolated trajectory
between two coordinates over STOMP. It's for demoing live tracking without a real GPS device (the driver
screen's *simulated drive* does the same from the browser).

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

Two GitHub Actions workflows:

- **`.github/workflows/ci.yml` (backend):** **lint → test → build → deploy**, each stage gated on the
  previous one succeeding (a failing test stops the build stage from running).
  - **lint:** Checkstyle, covering unused imports, equals/hashCode and empty catch blocks. This is
    intentionally not a strict formatting ruleset: the codebase never adopted one, so enforcing one now
    would fail on style, not substance.
  - **test:** the full suite, including the Testcontainers integration tests (GitHub's `ubuntu-latest`
    runners have Docker preinstalled).
  - **build:** builds the actual multi-stage `Dockerfile`, the same one used for deployment.
  - **deploy:** currently a placeholder that only runs on `main`.
- **`.github/workflows/pages.yml` (web app):** on every push to `main` that touches `web/` (or on a manual
  run), it runs `npm ci`, the tests and the production build, then publishes `web/dist` to GitHub Pages.

## Deploying the web app (GitHub Pages)

One-time setup:

1. Push this repository (including `web/` and `.github/workflows/pages.yml`) to GitHub.
2. On GitHub, open the repo → **Settings → Pages**. Under **Build and deployment → Source**, choose
   **GitHub Actions**.
3. Open the **Actions** tab, select **Deploy web app to GitHub Pages** → **Run workflow** (or just push a
   change under `web/`).
4. When the run finishes, the site is live at **`https://<your-github-username>.github.io/<repo-name>/`**.
   For this repo that's https://dlegendz.github.io/Waypoint/. The URL is also shown on the workflow run and
   under Settings → Pages.

Every later push to `main` that changes `web/` redeploys automatically. The build uses relative asset
paths, so it works under any repository name. With no API configured, the site runs in demo mode.

## Deploying the backend

Everything on the code side is ready:

- Multi-stage `Dockerfile` that runs as a non-root user.
- `render.yaml` blueprint targeting Render, with `App/Dockerfile` as the build.
- `server.port` respects Render's injected `$PORT` instead of a hardcoded value.
- `/actuator/health` for Render's health check.
- Every secret and connection value is driven by an env var; nothing is hardcoded (see `App/.env.example`).

The remaining blocker is outside the code. Provisioning a managed Postgres + Redis instance for the
deployed environment needs a payment method on file (even free tiers on Render/Neon/Upstash generally ask
for card verification), and a card issue has made that step unavailable for now. The full flow has been
verified end-to-end locally via `docker compose up` together with the web app: register → login → create
order → nearest-driver match → live location broadcast → stage transitions → history → dispatcher board.

## Connecting the web app to a deployed API

Once the API is live (say at `https://waypoint-api.onrender.com`):

1. **Backend env vars:** set these on Render (or wherever the API is hosted):
   - `CORS_ALLOWED_ORIGINS=https://dlegendz.github.io` (the origin only, with no path)
   - `COOKIE_SECURE=true`
   - `COOKIE_SAME_SITE=None` (the site and the API are on different domains, so the cookie has to be
     allowed cross-site)
2. **Web app:** in the GitHub repo → **Settings → Secrets and variables → Actions → Variables**, add a
   repository variable `WAYPOINT_API_URL` = `https://waypoint-api.onrender.com`, then re-run the Pages
   workflow. Visitors now use the real backend instead of the demo.

Anyone can also try it without rebuilding: the **Change** link on the sign-in screen accepts a server URL.

Note that because the site and API are on different domains, the auth cookie is a *third-party* cookie.
Browsers that block those by default (Safari; Chrome/Firefox with strict privacy settings) won't keep the
session. The robust fix is to serve the web app and API from the same site, e.g. a custom domain with the
API on `api.` and the site on `www.`, or by serving `web/dist` from Spring Boot.

## Trade-offs & Design Decisions

- **Redis for ephemeral state, Postgres for durable state.** A driver's live location changes every few
  seconds and is only ever needed at its latest value, so writing it to Postgres on every ping would be
  wasteful. Redis holds the latest value. The full history is still durably logged to Postgres, just
  asynchronously, off the critical broadcast path.
- **Cookie-based JWT, not Authorization headers.** Injected or malicious JS can't read an httpOnly cookie,
  which closes off a whole class of XSS-driven token theft that a `localStorage`-held bearer token is
  exposed to. The cost is that it needs a `HandshakeInterceptor` at the WebSocket layer (STOMP frames don't
  carry cookies) and explicit CORS/SameSite settings for a separately hosted frontend. Both are now
  env-configurable.
- **Raw WebSocket endpoint (`/ws/websocket`) for every client.** The web app, the driver simulator and any
  headless client connect straight to the raw endpoint instead of negotiating through SockJS. It's simpler
  and avoids SockJS's XHR-transport CORS/credentials quirks entirely.
- **The web app polls for stage changes; only location is pushed.** Stage transitions are rare and polling
  every 4 s is plenty. Live location, which changes every few seconds and is what makes the map feel alive,
  goes over STOMP.
- **Demo mode mirrors the backend rules in TypeScript.** This lets the portfolio site be clickable with no
  paid hosting. The cost is two implementations of the same rules; `engine.test.ts` pins the demo to the
  same behaviour the Java tests check.
- **`ddl-auto: update` instead of a migration tool (Flyway/Liquibase).** It was faster to iterate through a
  daily build-and-fix cycle. The known cost is schema-drift risk and no rollback story. That's acceptable
  for a single-developer portfolio project, but it's the first thing to replace before this became a real
  product.
- **Fixed-window rate limiting, not a sliding window or token bucket.** A Redis `INCR` + `EXPIRE` pair is
  simple and cheap. The cost is that it allows a burst right at the window boundary (e.g. two windows' worth
  of requests clustered around the reset). Login and order creation have separate per-IP counters.
- **Nearest-driver matching runs synchronously inside the order-creation request**, scanning all
  `ONLINE_AVAILABLE` drivers with a known location. That's simple and correct at demo scale (dozens of
  drivers). It would need to move to a spatial index (e.g. Redis geo commands) or a background matcher if
  the driver pool ever got large.
- **Single-instance WebSocket broker (Spring's built-in `SimpleBrokerMessageHandler`).** Documented but
  not implemented: horizontally scaling this would need an external broker (RabbitMQ, or Redis pub/sub) so
  that a broadcast reaches a subscriber connected to a *different* app instance. That's out of scope for a
  single-region portfolio deployment.

## Changelog

**Web app + backend fixes (September 2026)**

- Added the web app (`web/`): customer tracking, driver console, dispatcher board, an in-browser demo mode,
  and a GitHub Pages deployment workflow.
- New endpoints (from the PRD) needed by the web app: `GET /api/orders`, `GET /api/orders/{id}`,
  `GET /api/orders/{id}/history`, `GET /api/orders/{id}/location`, `GET /api/drivers/me`,
  `GET /api/dispatch/drivers`, `GET /api/auth/me`, `POST /api/auth/logout`.
- Fixed: `GET /api/dispatch/overview` always returned 500. The JPQL query returns the enum itself (not a
  `String`), and the cached DTO wasn't `Serializable`.
- Fixed: a driver had no way to report their position before getting an order, so newly registered drivers
  were never matched. `PATCH /api/drivers/me/status` now accepts optional `lat`/`lng`.
- Fixed: drivers stayed `ONLINE_BUSY` forever after an order finished. They now go back to available on
  `DELIVERED`/`CANCELLED`. A driver who still holds an active order can't flip themselves to available.
- Customers can cancel their own order while it's `CREATED` or `ASSIGNED` (previously nobody could cancel a
  `CREATED` order).
- The automatic `CREATED → ASSIGNED` move is now recorded in the stage history.
- Login and order creation no longer share one per-IP rate-limit counter.
- Timestamps in responses include the UTC offset, so clients in other time zones read them correctly.
- Unauthenticated requests get 401 instead of 403.
- Env-configurable CORS, cookie SameSite, and an optional seeded dispatcher account.

## Known Limitations

- Orders created while no driver is available stay `CREATED`; there's no background re-matching yet. The
  customer can cancel and order again.
- Admin manual reassignment for stuck or flagged orders isn't built. Flagged orders are visible on the
  dispatcher board, but resolving them is still a manual DB operation.
- Logging out clears the cookie, but the stateless JWT itself stays valid until it expires (2h TTL); there's
  no server-side revocation list.
- Dispatcher counts are cached for up to 45 s, so the board can lag slightly behind the order list.
- ETA is straight-line distance at an assumed 40 km/h, not road routing (a deliberate non-goal in the PRD).
- Demo-mode data lives in each visitor's browser only, and simulated drivers move faster than real traffic
  so a trip finishes in under a minute.
- Map tiles come from the public OpenStreetMap tile server, which is fine for a portfolio demo. A
  high-traffic deployment should switch to a tile provider with a usage plan.
