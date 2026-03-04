# Storedog Fork — Observability Demo

> A modernized fork of [Storedog](https://github.com/DataDog/storedog) built for Datadog APM, Profiling, Logs, and RUM demonstrations. It replaces the original Ruby on Rails backend with purpose-built Python microservices, migrates the frontend to Remix, and adds configurable failure modes for lab scenarios.

---

## What Changed From the Original

| Area | Original | This Fork |
|---|---|---|
| **Frontend** | Next.js 12, React 17 | Remix (React Router v2), React 18 |
| **Product Catalog** | Ruby on Rails + Spree API | Python / FastAPI (`store-catalog`) |
| **Shopping Cart** | Ruby on Rails + Spree API | Python / FastAPI (`store-cart`) |
| **Backend** | Ruby on Rails + Spree (full) | Removed — catalog + cart replace it |
| **Worker** | Sidekiq (Ruby) | Removed — no background jobs needed |
| **Port** | `80` | `9090` (via `docker-compose.port-9090.yml`) |
| **Node.js APM** | Not initialized in dev mode | `NODE_OPTIONS` injects `dd-trace` in all modes |
| **Trace propagation** | Datadog headers only | W3C TraceContext + Datadog (dual-format) |
| **Flash Sales** | Not present | `/flash-sale` endpoint + countdown banner |
| **Rate Limiting** | Not present | Redis-backed per-IP rate limiting on discount validation |
| **Session Debug Panel** | Not present | Collapsible RUM event viewer in-browser |
| **Failure Modes** | Discounts only | All services (env-var controlled per-service degradation) |

Services that are **unchanged**: Ads (Java), nginx/service-proxy, PostgreSQL, Redis, Puppeteer, Datadog Agent.

---

## Architecture

```
Browser
  │
  └─► nginx (service-proxy :9090)
        ├─► /                       → frontend (Remix :3000)
        ├─► /services/catalog       → store-catalog (FastAPI :8000)
        ├─► /services/cart          → store-cart (FastAPI :8001)
        ├─► /services/discounts     → discounts (Flask :2814)
        └─► /services/ads           → ads (Java Spring Boot :3030)
                                       [optional A/B → ads-python :3030]

Shared infrastructure:
  PostgreSQL :5432  ◄── catalog, cart, discounts, ads
  Redis :6379       ◄── discounts (rate limiting + flash sale cache)
  Datadog Agent     ◄── all services (APM, logs, metrics, profiling)
  Puppeteer         ──► nginx (synthetic user sessions)
```

### Service Summary

| Service | Language | Port | `DD_SERVICE` |
|---|---|---|---|
| Frontend | TypeScript / Remix | 3000 (internal) | `store-frontend-api` (server), `store-frontend` (RUM) |
| Catalog | Python / FastAPI | 8000 | `store-catalog` |
| Cart | Python / FastAPI | 8001 | `store-cart` |
| Pricing Engine | Python / FastAPI | 8002 | `store-pricing-engine` |
| Discounts | Python / Flask | 2814 | `store-discounts` |
| Ads | Java / Spring Boot | 3030 | `store-ads` |
| Nginx | C (nginx + DD module) | 9090 | `service-proxy` |
| PostgreSQL | — | 5432 | `store-db` |
| Redis | — | 6379 | `redis` |

---

## Quick Start

### Prerequisites

- Docker + Docker Compose V2
- A Datadog account with an API key (optional — app runs without one, APM/logs won't ship)

### 1. Copy and configure environment

```bash
cp .env.template .env
```

Open `.env` and fill in your Datadog credentials:

```bash
DD_API_KEY=your_api_key_here
NEXT_PUBLIC_DD_APPLICATION_ID=your_rum_application_id   # optional
NEXT_PUBLIC_DD_CLIENT_TOKEN=your_rum_client_token       # optional
```

All other values have sensible defaults and can be left as-is for local development.

### 2. Start the fork

The fork always uses **two** compose files: the base dev config and the port override.

```bash
docker compose -p storedog-fork \
  -f docker-compose.dev.yml \
  -f docker-compose.port-9090.yml \
  up -d
```

### 3. Open the app

Visit **http://localhost:9090**

The frontend takes ~15 seconds on first start while services initialize. If you see a loading screen, wait a moment and refresh.

> **Running alongside the original?**
> The `-p storedog-fork` project flag isolates containers and volumes. The original storedog (if running) stays on port 80 and is unaffected.

### 4. Verify Datadog connectivity

```bash
docker exec storedog-fork-dd-agent-1 agent status | grep -A 5 "APM Agent"
docker exec storedog-fork-dd-agent-1 agent status | grep -A 5 "Logs Agent"
```

All language runtimes should appear under `Receiver (previous minute)`:
`python` (×3), `nodejs`, `java`, `cpp` (nginx)

---

## Environment Variables

### Datadog Credentials

| Variable | Required | Description |
|---|---|---|
| `DD_API_KEY` | Yes (to ship data) | Datadog API key |
| `DD_APP_KEY` | No | Datadog application key |
| `NEXT_PUBLIC_DD_APPLICATION_ID` | No | RUM application ID |
| `NEXT_PUBLIC_DD_CLIENT_TOKEN` | No | RUM client token |
| `NEXT_PUBLIC_DD_SITE` | No | Datadog site (default: `datadoghq.com`) |

### Environment and Versioning

| Variable | Default | Description |
|---|---|---|
| `DD_ENV` | `development` | Datadog environment tag |
| `DD_HOSTNAME` | `development-host` | Agent hostname |
| `NEXT_PUBLIC_DD_VERSION_FRONTEND` | `1.0.0` | Frontend service version |
| `DD_VERSION_CATALOG` | `1.0.0` | Catalog service version |
| `DD_VERSION_CART` | `1.0.0` | Cart service version |
| `DD_VERSION_DISCOUNTS` | `1.0.0` | Discounts service version |
| `DD_VERSION_ADS` | `1.0.0` | Ads service version |
| `DD_VERSION_NGINX` | `1.28.0` | Nginx version tag |
| `DD_VERSION_POSTGRES` | `15.0` | PostgreSQL version tag |
| `DD_VERSION_REDIS` | `6.2` | Redis version tag |

### Database

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `postgres` | Database username |
| `POSTGRES_PASSWORD` | `postgres` | Database password |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `FRONTEND_COMMAND` | `npm run dev` | Command used to start the frontend |
| `NEXT_PUBLIC_ADS_ROUTE` | `/services/ads` | Client-side path to ads service |
| `NEXT_PUBLIC_DISCOUNTS_ROUTE` | `/services/discounts` | Client-side path to discounts service |
| `CATALOG_API_HOST` | `http://service-proxy/services/catalog` | Catalog URL for server-side Remix loaders |
| `CART_API_HOST` | `http://service-proxy/services/cart` | Cart URL for server-side Remix loaders |

### Nginx A/B Traffic Splitting

Controls traffic split between the Java ads service (A) and optional Python ads service (B).

| Variable | Default | Description |
|---|---|---|
| `ADS_A_UPSTREAM` | `ads:3030` | Primary (Java) ads service |
| `ADS_B_UPSTREAM` | `ads-python:3030` | Secondary (Python) ads service |
| `ADS_B_PERCENT` | `0` | % of traffic routed to B. Set >0 only when `ads-python` is running |

### Puppeteer

| Variable | Default | Description |
|---|---|---|
| `STOREDOG_URL` | `http://service-proxy:80` | URL Puppeteer browses |
| `PUPPETEER_TIMEOUT` | `30000` | Session timeout in ms |
| `SKIP_SESSION_CLOSE` | _(empty)_ | Set to `true` to leave sessions open |

---

## Failure Modes and Feature Flags

These variables inject specific failure patterns for demonstrating APM, Profiling, and Error Tracking. **None are enabled by default.** Set them in `.env` or directly in the service's `environment:` block in `docker-compose.dev.yml`, then restart the affected service.

---

### Discounts — Promotion Engine Degradation

Applies to **every request** on `store-discounts` via a Flask `before_request` hook (`services/discounts/promo_middleware.py`).

| Variable | Default | Effect when set |
|---|---|---|
| `PROMO_ENGINE_RESPONSE_TIME_MS` | `0` | Adds a fixed delay (ms) to every request. Visible as increased latency on the `flask.request` span in APM. |
| `PROMO_ENGINE_OUTAGE_RATE` | `0.0` | Probability (0.0–1.0) that any request returns HTTP 503. Useful for Error Tracking demos. |
| `PROMO_ENGINE_DEGRADED` | `false` | When `true`, delay and error rate become random per request (0–2000ms, random errors), simulating a flapping service. |

**Example — add 400ms latency to all discount calls:**

```bash
# .env
PROMO_ENGINE_RESPONSE_TIME_MS=400
```

```bash
docker compose -p storedog-fork -f docker-compose.dev.yml -f docker-compose.port-9090.yml \
  up -d --no-deps discounts
```

**What to look for in Datadog:** The `store-discounts` service latency spikes in APM. The `store-cart` service shows increased `cart.apply_coupon_code` duration as it waits on the downstream discount call. This is a good demo of how latency cascades through a distributed trace.

---

### Discounts — Broken Validation

Controlled via `services/discounts/discounts.py`.

| Variable | Values | Effect |
|---|---|---|
| `BROKEN_DISCOUNTS` | `ENABLED` / _(unset)_ | When `ENABLED`, the `/discount-code` endpoint raises an exception on ~50% of valid lookups (returns HTTP 500). The remaining 50% succeed normally. |

**What to look for in Datadog:** Error spans on `GET /discount-code`, error logs with Python stack traces in the Logs tab of the trace, and a rising error rate on the `store-discounts` service card in APM.

---

### Catalog — N+1 Query Problem *(planned)*

> **Status:** Implementation in progress. See `services/catalog/main.py`.

| Variable | Default | Effect when set |
|---|---|---|
| `CATALOG_N_PLUS_ONE` | `false` | Removes SQLAlchemy `selectinload` from `GET /products`. Each product's variants, images, and taxons are lazy-loaded one-by-one, producing ~1 + 4N SQL queries per page load instead of 4. With 15 products in the seed data, this yields ~61 queries per homepage load. |

**What to look for in Datadog:** A single `GET /products` span containing a waterfall of 40–60 `postgresql.query` child spans in the trace flame graph. The N+1 pattern is immediately visible. In Continuous Profiler, the function `_product_to_schema` will appear as a hotspot.

---

### Ads — Campaign Service Degradation

The Java ads service has an `InfrastructureInterceptor` (`services/ads/java/src/main/java/adsjava/InfrastructureInterceptor.java`) that follows the same contract as the Python middleware.

| Variable | Default | Effect when set |
|---|---|---|
| `CAMPAIGN_DB_QUERY_LATENCY_MS` | `0` | Fixed latency on ad requests |
| `CAMPAIGN_FETCH_FAILURE_RATE` | `0.0` | Probability (0.0–1.0) of returning HTTP 503 |
| `CAMPAIGN_SERVICE_DEGRADED` | `false` | Random latency + error combination |

**What to look for in Datadog:** Failed ad fetches appear in the frontend's `store-frontend-api` traces as 5xx upstream errors from `service-proxy`. The `store-ads` service shows error spans and `error.message` tags in APM.

---

### Dynamic Pricing Engine

The `dynamic-pricing` feature simulates a real-world pricing service that evaluates 10,000 pricing rules on every add-to-cart action. It demonstrates how a legitimate feature addition can introduce significant performance degradation and memory growth — patterns that are highly visible in Datadog APM and infrastructure metrics.

**How to enable:**

Set `FEATURE_FLAG_DYNAMIC_PRICING=true` in your `.env` file and restart the `store-cart` service:

```bash
FEATURE_FLAG_DYNAMIC_PRICING=true docker compose up store-cart store-pricing-engine
```

**What you'll see in Datadog:**

- **APM Service Map**: `store-pricing-engine` appears as a new downstream dependency of `store-cart`
- **Trace Waterfall**: `pricing_engine.evaluate_rules` span visible as the bottleneck in every `add_item` trace
- **Latency**: `store-cart` `add_item` p95 climbs from ~300ms to 2–4s
- **Memory**: `store-pricing-engine` container memory grows ~500KB per add-to-cart (unbounded decision cache)
- **Span Tags**: `pricing.rules_evaluated`, `pricing.rule_matched`, `pricing.final_price`, `pricing.cache_size`

**Tuning:**

| Variable | Default | Description |
|---|---|---|
| `PRICING_RULES_COUNT` | `10000` | Number of pricing rules evaluated per request (higher = more latency) |
| `PRICING_DECISION_PADDING_KB` | `20` | Additional context stored per cached decision (higher = faster memory growth) |
| `PRICING_CACHE_ENABLED` | `true` | Enable/disable the decision cache (set `false` to isolate latency from memory effects) |

---

### Frontend — Session Debug Panel

Built into the frontend at `services/frontend/components/SessionDebugPanel.tsx`. No environment variable needed.

The panel starts **minimized**. Click **"Show Session Debug"** in the bottom-right corner to expand it. It captures RUM events via `datadogRum.beforeSend` and displays them in real time — useful for verifying RUM instrumentation without opening browser DevTools.

Source: `services/frontend/components/SessionDebugPanel.tsx`

---

## Datadog Instrumentation Details

### APM Tracing

All services send traces to the Datadog Agent at `dd-agent:8126`.

| Service | Tracer | How it's loaded |
|---|---|---|
| Frontend (server) | `dd-trace` v5 (Node.js) | `NODE_OPTIONS=--import /app/node_modules/dd-trace/initialize.mjs` |
| Catalog | `ddtrace` (Python) | `ddtrace-run uvicorn ...` |
| Cart | `ddtrace` (Python) | `ddtrace-run uvicorn ...` |
| Discounts | `ddtrace` (Python) | `ddtrace-run flask run ...` |
| Ads | Datadog Java Agent | `-javaagent` JVM flag in Dockerfile |
| Nginx | nginx-datadog C++ module | `load_module` in `nginx.conf` |

> **Why `NODE_OPTIONS` and not `--require`?**
> The frontend package is `"type": "module"` (ESM). CommonJS `--require` does not work in ESM scope. `dd-trace` v5 ships `initialize.mjs` specifically for ESM projects; `--import` loads it before any application code runs. The `npm start` script uses `node --require ./datadog-tracer.js` for production builds — that works because compiled Remix output is CommonJS.

### Trace Propagation

All services use **dual-format propagation**: W3C TraceContext (`traceparent`/`tracestate`) as primary, Datadog headers (`x-datadog-trace-id` etc.) as secondary.

```yaml
DD_TRACE_PROPAGATION_STYLE=tracecontext,datadog
```

This means a request that enters via nginx carries a `traceparent` header that the frontend, catalog, cart, and discounts services all read and continue — producing a single distributed trace across all five services for a user checkout.

### Custom Span Tags

These tags are set on key spans and can be used in Trace Explorer and dashboards:

| Tag | Service | Endpoint |
|---|---|---|
| `catalog.result.count` | store-catalog | `GET /products` |
| `catalog.filter.taxon` | store-catalog | `GET /products?taxon=` |
| `catalog.product.slug` | store-catalog | `GET /products/{slug}` |
| `catalog.product.price` | store-catalog | `GET /products/{slug}` |
| `cart.total` | store-cart | `POST /cart/add_item`, `PATCH /checkout/complete` |
| `cart.item_count` | store-cart | `POST /cart/add_item`, `PATCH /checkout/complete` |
| `cart.variant_id` | store-cart | `POST /cart/add_item` |
| `discount.code` | store-cart | `PATCH /cart/apply_coupon_code` |
| `discount.tier` | store-discounts | `GET /discount-code` |
| `discount.value` | store-discounts | `GET /discount-code` |
| `order.id` | store-cart | `PATCH /checkout/complete` |

### Profiling

Continuous profiling is enabled on all services in dev:

```yaml
DD_PROFILING_ENABLED=true
DD_PROFILING_TIMELINE_ENABLED=true
DD_PROFILING_ALLOCATION_ENABLED=true
```

### Logs

Python services emit structured JSON logs with `dd.trace_id` and `dd.span_id` injected via `DD_LOGS_INJECTION=true`. The agent tails container stdout/stderr and ships to Datadog via HTTPS.

The agent excludes original-storedog containers from log and metric collection:

```yaml
DD_CONTAINER_EXCLUDE=image:agent name:puppeteer name:storedog-original
```

### RUM

Client-side RUM is initialized in `services/frontend/app/entry.client.tsx`. With real `NEXT_PUBLIC_DD_APPLICATION_ID` and `NEXT_PUBLIC_DD_CLIENT_TOKEN` values, session replays and RUM events ship to Datadog. With the default placeholder values, RUM initializes silently and the Session Debug Panel still captures events locally.

---

## Development Workflow

### Rebuild a single service after code changes

```bash
docker compose -p storedog-fork \
  -f docker-compose.dev.yml \
  -f docker-compose.port-9090.yml \
  up -d --no-deps --build <service-name>
```

Catalog and cart reload automatically on file save (uvicorn `--reload`). The frontend hot-reloads via Vite. Only the ads service (Java) requires a full `--build`.

### View logs

```bash
# All services
docker compose -p storedog-fork -f docker-compose.dev.yml -f docker-compose.port-9090.yml logs -f

# Single service
docker compose -p storedog-fork -f docker-compose.dev.yml -f docker-compose.port-9090.yml logs -f store-catalog
```

### Check agent health

```bash
docker exec storedog-fork-dd-agent-1 agent status
```

### Run E2E tests

Playwright tests live in `e2e/` and cover the Session Debug Panel and key user flows.

```bash
cd e2e
BASE_URL=http://localhost:9090 npx playwright test
```

---

## Key Source Files

| File | What it does |
|---|---|
| `docker-compose.dev.yml` | Full development stack definition |
| `docker-compose.port-9090.yml` | Port override — exposes nginx on 9090 |
| `.env` | Local environment configuration |
| `services/frontend/app/root.tsx` | Remix document root — ENV passthrough, RUM user init, Session Debug Panel |
| `services/frontend/app/entry.client.tsx` | Client hydration — Datadog RUM SDK initialization |
| `services/frontend/components/SessionDebugPanel.tsx` | In-browser RUM event viewer |
| `services/frontend/components/common/Discount/Discount.tsx` | Discount banner with flash sale countdown and copy button |
| `services/frontend/app/routes/_index.tsx` | Homepage — hero, category grid, product marquee |
| `services/catalog/main.py` | FastAPI catalog — all product and taxon endpoints |
| `services/cart/main.py` | FastAPI cart — cart, checkout, coupon endpoints |
| `services/cart/promotions.py` | Coupon validation — calls discounts service with trace propagation |
| `services/discounts/discounts.py` | Flask discounts — code lookup, flash sales, referral, rate limiting |
| `services/discounts/promo_middleware.py` | Promotion engine degradation middleware |
| `services/ads/java/src/main/java/adsjava/InfrastructureInterceptor.java` | Java infrastructure interceptor |
| `services/nginx/default.conf.template` | Nginx routing and A/B ads traffic split |
| `e2e/tests/` | Playwright E2E tests |

---

## Architecture Decisions

**Why replace Rails with FastAPI?**
The original Spree backend was a large Ruby monolith that obscured service boundaries. Splitting it into a dedicated `store-catalog` (read-only products) and `store-cart` (session-scoped orders) service creates a realistic microservice boundary that produces interesting distributed traces — a catalog lookup during `add_item` creates a cross-service span from `store-cart` → `store-catalog`, visible in the APM trace flame graph.

**Why Remix instead of Next.js?**
Remix provides a clean server/client boundary with Vite-powered hot reload in dev. Each page load produces both a `nodejs` APM span (server-side loader) and a RUM page view (client-side), connected by the same trace ID. This makes the frontend a good vehicle for demonstrating full-stack trace correlation.

**Why dual-format trace propagation?**
W3C TraceContext (`traceparent`) is the emerging standard and is compatible with OpenTelemetry-instrumented services. Keeping Datadog headers as a secondary format ensures all existing instrumentation continues to work without modification.

**Why `NODE_OPTIONS` for dd-trace in dev?**
Remix dev mode uses Vite's dev server (`remix vite:dev`), which does not pass through flags you add to `npm start`. `NODE_OPTIONS` is the only hook that Node respects regardless of how the process is launched. The `.mjs` path is required because the project is `"type": "module"` — CommonJS `require()` is unavailable in ESM scope.
