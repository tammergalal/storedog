# Lab Scenario Guide

This guide documents all configurable service degradation variables for Storedog, how to activate them, and exactly where to find the resulting signals in Datadog. Use this when building lab exercises that require realistic failure scenarios.

---

## The Baseline Guarantee

**When none of these environment variables are set, every service runs cleanly with zero degradation.**

Each variable has a safe default baked into `docker-compose.yml`:

```yaml
- PROMO_ENGINE_OUTAGE_RATE=${PROMO_ENGINE_OUTAGE_RATE:-0.0}   # default: no errors
- PROMO_ENGINE_RESPONSE_TIME_MS=${PROMO_ENGINE_RESPONSE_TIME_MS:-0}  # default: no delay
- PROMO_ENGINE_DEGRADED=${PROMO_ENGINE_DEGRADED:-false}        # default: off
```

If the host environment has no value for a variable, Docker Compose resolves it to the right-hand default. The middleware inside each service is a no-op at these defaults — it adds no latency, returns no errors, and has no measurable overhead.

**To disable a scenario:** remove the variable from `.env` or set it back to its default value and restart the affected service.

---

## How to Activate a Scenario

There are three ways to inject degradation, in order of preference for lab use:

### Method 1 — `.env` file (recommended for lab provisioning)

Add variables to `.env` at the project root. Docker Compose automatically loads this file on every `up` / `restart`:

```bash
# .env
PROMO_ENGINE_OUTAGE_RATE=0.3
PROMO_ENGINE_RESPONSE_TIME_MS=500
```

Then restart the affected service:

```bash
docker compose up -d --no-deps discounts
```

**To reset:** remove the lines from `.env` and restart the service.

### Method 2 — Override file (recommended for multiple named scenarios)

Create `docker-compose.override.yml` alongside the main compose file. Docker Compose merges it automatically:

```yaml
# docker-compose.override.yml
services:
  discounts:
    environment:
      - PROMO_ENGINE_OUTAGE_RATE=0.4
      - PROMO_ENGINE_RESPONSE_TIME_MS=800
  store-catalog:
    environment:
      - CATALOG_IMAGE_CDN_LATENCY_MS=1200
```

```bash
docker compose up -d
```

**To reset:** delete `docker-compose.override.yml` and restart:

```bash
rm docker-compose.override.yml
docker compose up -d
```

### Method 3 — Shell export (recommended for ad-hoc testing)

Export variables in the shell before running Docker Compose. Docker Compose reads from the shell environment:

```bash
export PAYMENT_GATEWAY_LATENCY_MS=2000
docker compose up -d --no-deps store-cart
```

**To reset:** unset the variable and restart:

```bash
unset PAYMENT_GATEWAY_LATENCY_MS
docker compose up -d --no-deps store-cart
```

### Targeted restart command

All three methods require restarting the affected service to pick up the new environment. Use `--no-deps` to avoid restarting unaffected services:

```bash
docker compose up -d --no-deps <service-name>
```

Service names: `frontend`, `store-catalog`, `store-cart`, `discounts`, `ads`, `store-pricing-engine`

---

## Quick Reference — All Variables

| Variable | Service | Type | Default | What it does |
|---|---|---|---|---|
| `UPSTREAM_API_FAILURE_RATE` | store-frontend | float 0–1 | `0.0` | Fraction of `/api/` requests that return 503 |
| `UPSTREAM_API_TIMEOUT_MS` | store-frontend | int ms | `0` | Latency added to every `/api/` request |
| `CATALOG_DB_FAILOVER_RATE` | store-catalog | float 0–1 | `0.0` | Fraction of requests that return 503 |
| `CATALOG_IMAGE_CDN_LATENCY_MS` | store-catalog | int ms | `0` | Latency added to every catalog request |
| `CATALOG_INCIDENT_MODE` | store-catalog | bool | `false` | Randomises failure rate (10–50%) and latency (100–2000ms) |
| `PAYMENT_PROCESSOR_FAILURE_RATE` | store-cart | float 0–1 | `0.0` | Fraction of requests that return 503 |
| `PAYMENT_GATEWAY_LATENCY_MS` | store-cart | int ms | `0` | Latency added to every cart request |
| `PAYMENT_DEGRADED_MODE` | store-cart | bool | `false` | Randomises failure rate and latency |
| `PROMO_ENGINE_OUTAGE_RATE` | store-discounts | float 0–1 | `0.0` | Fraction of requests that return 503 |
| `PROMO_ENGINE_RESPONSE_TIME_MS` | store-discounts | int ms | `0` | Latency added to every discount request |
| `PROMO_ENGINE_DEGRADED` | store-discounts | bool | `false` | Randomises failure rate and latency |
| `CAMPAIGN_FETCH_FAILURE_RATE` | store-ads (Java) | float 0–1 | `0.0` | Fraction of requests that return 503 |
| `CAMPAIGN_DB_QUERY_LATENCY_MS` | store-ads (Java) | int ms | `0` | Latency added to every ad request |
| `CAMPAIGN_SERVICE_DEGRADED` | store-ads (Java) | bool | `false` | Randomises failure rate and latency |
| `AD_TARGETING_FAILURE_RATE` | store-ads (Python) | float 0–1 | `0.0` | Fraction of requests that return 503 |
| `AD_TARGETING_LATENCY_MS` | store-ads (Python) | int ms | `0` | Latency added to every ad request |
| `AD_ENGINE_INCIDENT_MODE` | store-ads (Python) | bool | `false` | Randomises failure rate and latency |
| `PRICING_RULES_FETCH_FAILURE_RATE` | store-pricing-engine | float 0–1 | `0.0` | Fraction of requests that return 503 |
| `PRICING_RULES_DB_LATENCY_MS` | store-pricing-engine | int ms | `0` | Latency added to every pricing request |
| `PRICING_ENGINE_DEGRADED` | store-pricing-engine | bool | `false` | Randomises failure rate and latency |

---

## Per-Service Detail

### store-frontend

**Middleware file:** `services/frontend/app/entry.server.tsx`
**Applies to:** all `/api/` SSR route requests

#### Variables

| Variable | Effect |
|---|---|
| `UPSTREAM_API_FAILURE_RATE=0.3` | 30% of server-side API calls return a 503 JSON response |
| `UPSTREAM_API_TIMEOUT_MS=500` | 500ms added to every SSR API request before it processes |

#### Downstream cascade

The frontend calls `store-catalog` and `store-cart` for SSR. If those services are slow, the frontend inherits that latency. These variables simulate the frontend's own upstream connectivity being degraded, independently of whether the downstream services are healthy.

#### What you'll see in Datadog

| Product | Signal |
|---|---|
| **APM › Services** | `store-frontend-api` error rate spikes; `errors/s` metric rises |
| **APM › Service Map** | `store-frontend-api` node turns red |
| **APM › Traces** | Traces for `/api/*` routes show `error.type: "upstream_unavailable"`, HTTP status 503 |
| **Error Tracking** | New issue: _"Upstream service unavailable"_, grouped by fingerprint |
| **RUM** | Resource errors on XHR/fetch calls; Core Web Vitals degradation if SSR fails |
| **Logs** | Error log lines from `store-frontend` with `"upstream": "store-catalog"` |

---

### store-catalog

**Middleware file:** `services/catalog/upstream_middleware.py`
**Applies to:** all requests except `GET /health`

#### Variables

| Variable | Effect |
|---|---|
| `CATALOG_DB_FAILOVER_RATE=0.2` | 20% of product and taxon requests return 503 |
| `CATALOG_IMAGE_CDN_LATENCY_MS=1000` | 1 second added to every request (product listings, detail pages, taxon nav) |
| `CATALOG_INCIDENT_MODE=true` | Random 10–50% error rate and 100–2000ms latency, varying per request |

#### Downstream cascade

`store-cart` calls `store-catalog` on `POST /cart/{id}/add_item` to snapshot variant data. If catalog is slow or erroring, add-to-cart will be slow or fail. The distributed trace will show the failure originating in `store-catalog` even though `store-cart` is the service that surfaces the error to the frontend.

#### What you'll see in Datadog

| Product | Signal |
|---|---|
| **APM › Services** | `store-catalog` error rate and/or p95/p99 latency rises |
| **APM › Service Map** | `store-catalog` node turns red (errors) or yellow (latency); edge from `store-cart → store-catalog` lights up |
| **APM › Traces** | `store-catalog` spans show `http.status_code: 503` and `error.msg: "Upstream dependency unavailable..."` |
| **APM › Traces** | `store-cart` add-to-cart traces show upstream error propagating from catalog span |
| **Error Tracking** | Issue: _"Upstream dependency unavailable: product data service is experiencing elevated error rates"_ |
| **Logs** | 503 responses logged by the catalog service with `dd.trace_id` for correlation |
| **Watchdog** | Latency anomaly alert on `store-catalog` if `CATALOG_IMAGE_CDN_LATENCY_MS` is set high |

---

### store-cart

**Middleware file:** `services/cart/gateway_middleware.py`
**Applies to:** all requests except `GET /health`

#### Variables

| Variable | Effect |
|---|---|
| `PAYMENT_PROCESSOR_FAILURE_RATE=0.25` | 25% of cart requests (including checkout) return 503 |
| `PAYMENT_GATEWAY_LATENCY_MS=2000` | 2 seconds added to every cart operation |
| `PAYMENT_DEGRADED_MODE=true` | Random failure rate and 100–2000ms latency per request |

#### Downstream cascade

`store-cart` is a leaf in the call graph for checkout, so errors here don't cascade to other backend services. However, checkout failures are highly visible:
- Frontend checkout flow times out or shows error state
- RUM records the failed checkout action
- If `FEATURE_FLAG_DYNAMIC_PRICING=true`, pricing engine calls happen within cart requests — pricing engine latency and cart latency stack

#### What you'll see in Datadog

| Product | Signal |
|---|---|
| **APM › Services** | `store-cart` error rate spikes; checkout endpoints (`POST /cart/{id}/complete`) show the highest error rate |
| **APM › Service Map** | `store-cart` node turns red; edge from `store-frontend → store-cart` shows elevated error rate |
| **APM › Traces** | Cart spans tagged with `error.msg: "Payment gateway timeout..."`, `http.status_code: 503` |
| **APM › Traces** | Custom span tags `cart.total`, `cart.item_count`, `order.id` appear on failed spans — useful for showing business impact of errors |
| **Error Tracking** | Issue: _"Payment gateway timeout: the payment processor did not respond within the expected window"_ |
| **RUM** | Failed checkout actions tracked as RUM errors; Session Replay shows user hitting the error state |
| **Logs** | Error logs from `store-cart` with full stack trace correlated to trace via `dd.trace_id` |

---

### store-discounts

**Middleware file:** `services/discounts/promo_middleware.py`
**Applies to:** all requests except `GET /health`

#### Variables

| Variable | Effect |
|---|---|
| `PROMO_ENGINE_OUTAGE_RATE=0.4` | 40% of discount validation and flash sale requests return 503 |
| `PROMO_ENGINE_RESPONSE_TIME_MS=800` | 800ms added to every discount request |
| `PROMO_ENGINE_DEGRADED=true` | Random failure rate and latency, varying per request |

#### Downstream cascade

`store-cart` calls `store-discounts` on `POST /cart/{id}/apply_coupon_code` for discount validation. A slow or erroring discount service is visible in cart traces as an inflated or failed downstream call. This is one of the best scenarios for demonstrating distributed trace root cause analysis — the cart is "slow" but the cause lives one hop deeper in discounts.

#### What you'll see in Datadog

| Product | Signal |
|---|---|
| **APM › Services** | `store-discounts` error rate and/or latency spikes |
| **APM › Service Map** | Edge from `store-cart → store-discounts` turns red or orange; `store-discounts` node lights up |
| **APM › Traces** | Distributed trace shows: `store-frontend` → `store-cart` → `store-discounts` — error originates in `store-discounts` span |
| **APM › Traces** | `store-cart` `cart.apply_coupon_code` span duration inflates when `PROMO_ENGINE_RESPONSE_TIME_MS` is set |
| **Error Tracking** | Issue: _"Promotion engine temporarily unavailable"_, `retry_after: 5` in error body |
| **Logs** | Error logs from `store-discounts` correlated to cart trace via shared `dd.trace_id` |

---

### store-ads (Java)

**Interceptor file:** `services/ads/java/src/main/java/adsjava/InfrastructureInterceptor.java`
**Applies to:** all requests

#### Variables

| Variable | Effect |
|---|---|
| `CAMPAIGN_FETCH_FAILURE_RATE=0.3` | 30% of ad fetch requests return 503 |
| `CAMPAIGN_DB_QUERY_LATENCY_MS=600` | 600ms added to every ad request (simulates replica lag) |
| `CAMPAIGN_SERVICE_DEGRADED=true` | Random failure rate and latency per request |

#### Note on backward compatibility

The ads service also supports error injection via the `X-Throw-Error: true` request header. Header injection takes precedence — if the header is present, the request always errors regardless of `CAMPAIGN_FETCH_FAILURE_RATE`.

#### What you'll see in Datadog

| Product | Signal |
|---|---|
| **APM › Services** | `store-ads` error rate or latency rises |
| **APM › Service Map** | `store-ads` node turns red; edge from `service-proxy → store-ads` shows errors |
| **APM › Traces** | Ad fetch spans show `http.status_code: 503`, `error.msg: "Campaign data temporarily unavailable"` |
| **APM › Traces** | Java-specific: `servlet.request` root span carries error tags visible in the flame graph |
| **Error Tracking** | Issue: _"Campaign data temporarily unavailable"_ |
| **Logs** | Java structured logs with `dd.trace_id` MDC injection for correlation |
| **Profiler** | When `CAMPAIGN_DB_QUERY_LATENCY_MS` is set, wall-time profiling shows `Thread.sleep` in the interceptor stack frame |

---

### store-ads (Python — A/B variant)

**Middleware file:** `services/ads/python/targeting_middleware.py`
**Applies to:** all requests

#### Variables

| Variable | Effect |
|---|---|
| `AD_TARGETING_FAILURE_RATE=0.3` | 30% of ad requests return 503 |
| `AD_TARGETING_LATENCY_MS=600` | 600ms added to every ad request |
| `AD_ENGINE_INCIDENT_MODE=true` | Random failure rate and latency per request |

#### What you'll see in Datadog

Same surfaces as the Java ads service. If both the Java and Python ad variants are degraded simultaneously, the Service Map will show both edges from `service-proxy` to `store-ads-python` and `store-ads` as degraded.

---

### store-pricing-engine

**Middleware file:** `services/pricing_engine/rules_middleware.py`
**Applies to:** all requests except `GET /health`

#### Variables

| Variable | Effect |
|---|---|
| `PRICING_RULES_FETCH_FAILURE_RATE=0.2` | 20% of pricing evaluation requests return 503 |
| `PRICING_RULES_DB_LATENCY_MS=500` | 500ms added to every pricing request |
| `PRICING_ENGINE_DEGRADED=true` | Random failure rate and latency per request |

> `PRICING_RULES_DB_LATENCY_MS` is separate from `PRICING_FETCH_DELAY_MS`. The latter is an intentional profiling demo feature that simulates rule evaluation time; this variable simulates an upstream database read latency on top of normal processing.

#### Downstream cascade

`store-cart` calls `store-pricing-engine` when `FEATURE_FLAG_DYNAMIC_PRICING=true`. Pricing engine errors or latency appear in cart traces as a failed or slow downstream span on checkout and add-to-cart operations.

#### What you'll see in Datadog

| Product | Signal |
|---|---|
| **APM › Services** | `store-pricing-engine` error rate or latency rises |
| **APM › Service Map** | Edge from `store-cart → store-pricing-engine` lights up |
| **APM › Traces** | Pricing span shows `error.msg: "Pricing rules service degraded..."`, `http.status_code: 503` |
| **APM › Traces** | `store-cart` checkout traces show inflated total duration when pricing is slow |
| **Error Tracking** | Issue: _"Pricing rules service degraded: rule evaluation currently unavailable"_ |
| **Profiler** | `PRICING_RULES_DB_LATENCY_MS` + `PRICING_FETCH_DELAY_MS` together produce a clear wall-time hotspot in the pricing engine profiler flame graph |

---

## Pre-Built Scenarios

These are ready-to-use configurations for specific learning objectives.

---

### Scenario A — Discount Service Outage

**Learning objective:** Trace a user-facing error back to its root cause service using distributed tracing.

**What the learner observes:** Applying a coupon code during checkout fails intermittently. The cart service shows errors, but it isn't the root cause.

```bash
# .env additions
PROMO_ENGINE_OUTAGE_RATE=0.4
```

**Restart:**
```bash
docker compose up -d --no-deps discounts
```

**Investigation path in Datadog:**
1. **APM › Service Map** — `store-discounts` node turns red; edge from `store-cart` to `store-discounts` highlights
2. **APM › Traces** — Filter by `service:store-cart` and `status:error`; open a failed trace; the flame graph shows the error originates in the `store-discounts` child span, not in cart
3. **Error Tracking** — Issue fingerprinted as _"Promotion engine temporarily unavailable"_; occurrence count shows intermittency
4. **Logs** — Filter logs by `service:store-discounts` and `status:error`; log lines correlate to the trace via `dd.trace_id`

---

### Scenario B — Payment Gateway Latency

**Learning objective:** Identify a slow service using latency metrics and the trace flame graph.

**What the learner observes:** Checkout is slow. No errors are surfaced — just a degraded user experience.

```bash
# .env additions
PAYMENT_GATEWAY_LATENCY_MS=2000
```

**Restart:**
```bash
docker compose up -d --no-deps store-cart
```

**Investigation path in Datadog:**
1. **APM › Services** — `store-cart` p95/p99 latency spikes; the `POST /cart/{id}/complete` endpoint shows the highest average duration
2. **APM › Traces** — A cart trace shows the root span inflated by ~2 seconds; the flame graph reveals the wall time is consumed at the beginning of the `store-cart` span (the middleware)
3. **RUM** — Checkout action duration increases; Session Replay shows the spinner running for 2+ seconds before resolving
4. **Watchdog** — May trigger a latency anomaly alert on `store-cart` if Watchdog is enabled

---

### Scenario C — CDN Cascade

**Learning objective:** See how upstream latency in one service propagates through the full request path.

**What the learner observes:** Product pages load slowly. The slowness appears in the frontend, then in catalog, and eventually in cart (add-to-cart is also slow).

```bash
# .env additions
CATALOG_IMAGE_CDN_LATENCY_MS=1200
```

**Restart:**
```bash
docker compose up -d --no-deps store-catalog
```

**Investigation path in Datadog:**
1. **APM › Service Map** — `store-catalog` node shows elevated latency (yellow); the map shows the downstream impact propagating to `store-cart` (add-to-cart calls catalog) and `store-frontend`
2. **APM › Traces** — A frontend page load trace shows a slow `store-catalog` child span; the cart add-to-cart trace also shows catalog as the slow segment
3. **APM › Services** — Compare p50 vs p99 on `store-catalog`; latency is uniformly high (fixed delay vs spike), which looks different from a query regression
4. **Profiler** — `store-catalog` profiler shows wall-time skewed toward `asyncio.sleep` in the middleware stack

---

### Scenario D — Multi-Service Incident

**Learning objective:** Triage which service is the root cause when multiple services are degraded simultaneously.

**What the learner observes:** Both discount validation and product loading are failing. The learner must determine whether these are related or independent failures.

```bash
# .env additions
PROMO_ENGINE_OUTAGE_RATE=0.35
CATALOG_DB_FAILOVER_RATE=0.2
```

**Restart:**
```bash
docker compose up -d --no-deps discounts store-catalog
```

**Investigation path in Datadog:**
1. **APM › Service Map** — Both `store-discounts` and `store-catalog` nodes are red, but they have no dependency between them — two independent root causes
2. **Error Tracking** — Two distinct issues with separate fingerprints; occurrence counts, first-seen timestamps, and affected services are different — confirms independent failures
3. **APM › Traces** — Traces for discount errors always end in `store-discounts`; traces for catalog errors always end in `store-catalog`; the errors do not share a common ancestor span

---

### Scenario E — Flapping Services

**Learning objective:** Detect and investigate intermittent failures that don't produce a consistent error pattern.

**What the learner observes:** Errors appear and disappear. The error rate is non-zero but inconsistent — some requests succeed, some fail, with no obvious pattern.

```bash
# .env additions
CATALOG_INCIDENT_MODE=true
PAYMENT_DEGRADED_MODE=true
```

**Restart:**
```bash
docker compose up -d --no-deps store-catalog store-cart
```

**Investigation path in Datadog:**
1. **APM › Services** — Both `store-catalog` and `store-cart` show variable error rates and latency; the metrics shift over time because `_INCIDENT_MODE` randomises values per request
2. **Error Tracking** — Issues show an irregular spike pattern in the occurrence graph (not a flat rate) — characteristic of a flapping dependency
3. **APM › Traces** — Some traces for the same endpoint succeed with normal latency; others fail or are slow; compare adjacent traces to see the inconsistency
4. **Watchdog** — Anomaly detection is well-suited here; Watchdog may surface both services as anomalous before a learner identifies them manually

---

## Resetting to Baseline

To return all services to a clean, healthy state:

1. Remove any degradation variables from `.env`
2. Delete `docker-compose.override.yml` if present
3. Unset any exported shell variables
4. Restart all services:

```bash
docker compose down && docker compose up -d
```

Or restart only the affected services without full teardown:

```bash
docker compose up -d --no-deps store-catalog store-cart discounts store-pricing-engine ads frontend
```

After restart, verify health:

```bash
docker compose ps
```

All services should show `healthy` or `running`. The Datadog Service Map should return to all-green within the next polling interval (typically 30–60 seconds after traffic resumes).
