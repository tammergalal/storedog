# Storedog Overhaul Plan (Revised)

> Revised incorporating CODEX architectural review feedback.
> Strategy: feature-by-feature, each feature = independent branch + PR.
> Implemented via parallel AI agent teams per phase.

---

## Current Stack

| Service | Language/Framework | Notes |
|---|---|---|
| Frontend | Next.js 12, TypeScript, React 17, Tailwind CSS | Visually dated |
| Backend | Ruby on Rails 6.1 + Spree 4.4 | Headless e-commerce API |
| Worker | Sidekiq (Ruby) | Background jobs |
| Discount | Python/Flask | Minimal — create/list only |
| Ads (primary) | Java/Spring Boot 2.7.5 | Banner ads with A/B split |
| Ads (alt) | Python/Flask | A/B alternate |
| DBM | Python/Flask | Optional long-running query simulator |
| Infra | Postgres 15, Redis 6.2, Nginx + AppSec, Datadog Agent | — |

**Languages already instrumented:** Node.js, Ruby, Python, Java

---

## Constraints

- Feature-by-feature — each feature ships as an independent branch + PR
- All services containerized via Docker Compose
- Maintain existing `DD_SERVICE` / `DD_ENV` / `DD_VERSION` tagging on all services
- No breaking changes to existing Puppeteer synthetic sessions (enforced by selector contract — see Phase 0)
- No removal of existing service endpoints (additive changes only)
- New Rust and Elixir services use OpenTelemetry → Datadog exporter (not native dd-trace) — this must be explicit in implementation scope

---

## Phase 0 — Observability Contract *(new — unblocks all downstream work)*

> Must complete before any other phase begins. Defines the standards that all agents implement consistently.

### 0.1 — Trace Propagation Standard

Define and enforce a single propagation format across all existing services:
- **Standard:** W3C TraceContext (`traceparent` / `tracestate`) as primary, Datadog headers (`x-datadog-trace-id` etc.) as secondary
- Add propagation middleware/config to: frontend (`dd-trace` propagators), backend (datadog gem config), discounts (`ddtrace` config), ads-java (Spring Boot filter), ads-python (`ddtrace` config)
- Document which format each service emits and accepts in `docs/trace-propagation.md`

**DD Value:** Without this, distributed traces across 8+ services will be fragmented. This is the single highest-risk gap in the current setup.
**Complexity:** S

### 0.2 — Unified JSON Log Schema

All services must emit logs in a consistent JSON schema:

```json
{
  "timestamp": "ISO8601",
  "level": "info|warn|error",
  "message": "...",
  "service": "store-frontend",
  "env": "development",
  "version": "1.0.0",
  "dd.trace_id": "...",
  "dd.span_id": "..."
}
```

- Backend: lograge + `lograge_sql` with `dd.trace_id`/`dd.span_id` injected via ddtrace correlation
- Python services: named app logger (not `werkzeug`), `json_log_formatter` with ddtrace MDC
- Java ads: Logstash encoder already in place — verify `dd.trace_id` MDC injection
- Frontend: `next-logger` already in place — verify correlation fields on server-side spans

**DD Value:** Enables Log Correlation in APM (Logs tab in trace view). Prerequisite for any log-based lab.
**Complexity:** S

### 0.3 — Span Naming and Tag Convention

Define a cross-service semantic tag standard. All agents must follow this spec:

| Tag | Type | Example | Used by |
|---|---|---|---|
| `cart.total` | float | `42.99` | frontend, backend |
| `cart.item_count` | int | `3` | frontend, backend |
| `discount.code` | string | `BRONZE10` | frontend, discounts, backend |
| `discount.tier` | string | `bronze` | discounts, frontend |
| `discount.value` | float | `10.0` | discounts, backend |
| `ad.id` | int | `4` | ads |
| `ad.ab_group` | string | `control` | ads, frontend |
| `campaign.id` | int | `2` | ads |
| `order.id` | string | `R123456789` | backend, frontend |
| `user.id` | string | `42` | frontend, backend |
| `search.query` | string | `hat` | search |
| `search.results_count` | int | `5` | search |
| `inventory.variant_id` | int | `12` | inventory |
| `inventory.available` | int | `8` | inventory |

Document in `docs/span-tag-convention.md`.

**DD Value:** Consistent tags make Trace Explorer filtering and dashboard queries reliable across all services.
**Complexity:** S

### 0.4 — Puppeteer Selector Contract

Create `services/puppeteer/selectors-contract.json` listing every CSS selector and RUM action name the bot depends on. This file becomes the regression contract — any frontend PR must verify selectors still resolve before merging.

Include a lightweight check script `scripts/verify-selectors.js` that validates the contract against a running app.

**DD Value:** Prevents Phase 4 frontend redesign from silently breaking synthetic session traffic, which is what generates APM data in labs.
**Complexity:** S

### 0.5 — Seed Data Generator + Service Health Endpoints

- Add `scripts/seed-demo-data.sh` that populates DBM-scale data (1000+ orders, 500+ discount uses, 200+ ad clicks) to make Database Monitoring queries meaningful
- Add a `GET /health` endpoint to every service returning: `{ "service": "...", "version": "...", "dd_trace_enabled": true, "db_connected": true }`
- Add `GET /service-info` to return service name, language, framework, and tracer version — used in lab UI to confirm full stack is running

**DD Value:** Health endpoints confirm the full service map is instrumented. Seed data makes DBM demos non-trivial.
**Complexity:** S

### 0.6 — Shared Chaos/Delay Pattern

Standardize error injection across **all** services (existing and new) using environment variables:

```
SERVICE_ERROR_RATE=0.0    # 0.0–1.0, probability of returning 5xx
SERVICE_DELAY_MS=0         # artificial latency added to every request
SERVICE_CHAOS_MODE=false   # enables random mix of errors + delays
```

Implement as a middleware/decorator in each language. Document in `docs/chaos-pattern.md`.

**DD Value:** Makes error scenarios reproducible and configurable without code changes. Instructors can tune error rates per service for specific lab scenarios.
**Complexity:** S per service (existing); built-in from day 1 on new services

---

## Phase 1 — Foundation Fixes

> Depends on: Phase 0 complete
> All features can run in parallel.

### 1.1 — Fix Discount Code Application Gap

The checkout flow validates a code against the discount service but then silently calls Spree with the hardcoded string `FREESHIP` regardless of the result. Fix `CheckoutSidebarView.tsx` to pass the actual validated code. Update Spree seed data to include real promotion codes matching the discount service tier codes (BRONZE10, SILVER20, GOLD30, FREESHIP).

**Services:** `frontend`, `backend`
**Complexity:** S

### 1.2 — Custom Span Tags on Key Flows

Add meaningful custom span tags (per Phase 0.3 convention) to:
- `add-to-cart` → `cart.item_count`, `cart.total`
- `apply-discount` → `discount.code`, `discount.tier`, `discount.value`
- `confirm-purchase` → `order.id`, `cart.total`, `cart.item_count`

Frontend: use `dd-trace` span API on Next.js API routes. Backend: add to Rails controller concern.

**Services:** `frontend`, `backend`
**Complexity:** S

### 1.3 — Env-Var Feature Flags Endpoint

Add `GET /api/feature-flags` to the Next.js frontend. Reads from environment variables at runtime (`FEATURE_FLAG_DBM`, `FEATURE_FLAG_ERROR_TRACKING`, `FEATURE_FLAG_BROKEN_DISCOUNTS`, etc.) and returns them as JSON. Update all `codeStash` calls to fall back to this endpoint. Enables lab instructors to toggle scenarios via `docker compose` env vars without container rebuilds.

**Services:** `frontend`
**Complexity:** S

### 1.4 — Trace Propagation Validation (moved from Phase 6)

Add a checkout flow trace validation script (`scripts/validate-trace-propagation.sh`) that:
1. Triggers a complete checkout via curl
2. Queries the Datadog API for the resulting trace
3. Asserts that spans from frontend, backend, discounts, and ads all share the same `trace_id`

Run this in CI as a smoke test after deploy. Document expected trace shape in `docs/trace-propagation.md`.

**Services:** `scripts/`, all services
**Complexity:** S

---

## Phase 2 — Discount Service v2

> Depends on: Phase 0 + Phase 1 complete
> Features are sequential within this phase.

### 2.1 — Coupon Tiers (BRONZE10 / SILVER20 / GOLD30)

Extend the `Discount` model with a `tier` field (`bronze`, `silver`, `gold`). Add a `GET /discount-code?code=X` endpoint returning tier, discount type (percent/fixed), and value. Bootstrap seed data with real named codes. Update checkout to display tier name and discount amount. Add `discount.tier` and `discount.value` span tags.

**Services:** `discounts`, `backend` (Spree promotion seeds), `frontend`
**Complexity:** M

### 2.2 — Referral Codes with DBM-Ready Dataset

Add `referral_source` field to `Discount`. Add `GET /referral?ref=INFLUENCER_NAME` endpoint using an influencer JOIN query. Seed 500+ influencer-linked discount uses so DBM shows meaningful query stats. Frontend reads `?ref=` query param on load, stores in `localStorage`, auto-populates checkout discount field.

**Note:** Small seed data won't produce DBM signal — seed script from Phase 0.5 must include referral discount volume.

**Services:** `discounts`, `frontend`
**Complexity:** M

### 2.3 — Flash Sales (Time-Limited Discounts)

Add `start_time` and `end_time` columns to `Discount`. Add `GET /flash-sale` endpoint returning active sale (if any). Replace 30s polling with a longer TTL cache (60s) + server-sent event push on sale activation to reduce APM noise. Update the frontend `Discount` banner component to show countdown timer when a sale is active, dismissible via `sessionStorage`.

**Note:** 30s polling creates too much baseline noise for demo environments. SSE + 60s cache TTL gives a better signal-to-noise ratio.

**Services:** `discounts`, `frontend`
**Complexity:** M

### 2.4 — Redis-Backed Rate Limiting

Add Redis-backed rate limiting to discount validation: 429 after >5 invalid codes/60s per IP. Return `Retry-After` header. Emit warning log with `discount.code` and `client.ip` tags. Use `redis-py`.

**Services:** `discounts`, `docker-compose.yml` (add `REDIS_HOST` to discounts env)
**Complexity:** M

---

## Phase 3 — Ad Service Enhancement

> Depends on: Phase 0 + Phase 1 complete
> Features are sequential within this phase.

### 3.1 — Campaign Management API

Add `Campaign` JPA entity: `id`, `name`, `startDate`, `endDate`, `budgetCents`, `targetTaxon`. Associate `Advertisement` with `Campaign` via FK. `GET /ads` filters to active, in-budget campaigns only. Add `GET /campaigns` and `POST /campaigns` endpoints. Seeds include 3 campaigns with date ranges that create visible "campaign ended" scenarios.

**Services:** `ads/java`
**Complexity:** M

### 3.2 — A/B Testing Restoration with Deterministic Bucketing

Add `ab_group` field (`control`/`variant`) to `Advertisement`. Hash the RUM session ID (passed as `X-Session-Id` header) to assign users deterministically to groups — **must be stable hashing, not random**, to avoid confusing metrics. Add `GET /ab-stats` endpoint. Frontend `Ad` component passes session ID header; logs `ad.ab_group`, `ad.id` on every request.

**Note:** Non-deterministic bucketing creates incoherent A/B stats. Stable hash on session ID is required.

**Services:** `ads/java`, `frontend`
**Complexity:** M

### 3.3 — Click Tracking (Simplified Async)

Simplified from original design: record click in `AdClick` table + push to a single Redis list. A Spring `@Scheduled` task (every 60s) aggregates clicks back to `Advertisement`. No fanout. Add `campaign.id` and `ad.ab_group` span tags to the click endpoint.

**Note:** Original fanout design was over-engineered for a demo. Single queue + aggregator creates the same HTTP→async trace pattern with less complexity.

**Services:** `ads/java`
**Complexity:** M

---

## Phase 4 — Frontend Redesign

> Depends on: Phase 2 + Phase 3 complete (backend APIs stable before UI is rebuilt)
> **Must run sequentially after Phase 2 and 3** — not in parallel.
> Ends with mandatory Puppeteer selector regression (Phase 0.4 contract).

### Design Direction

- **Primary color:** Keep Datadog purple `#632ca6` — intentional brand anchor for training materials
- **Neutral palette:** Off-white `#FAF8F5`, warm gray `#E8E4DF`, charcoal `#1A1A1A`
- **Typography:** `Inter` (body) + `Plus Jakarta Sans` (headings) via `next/font`
- **Component approach:** Extend Tailwind + `shadcn/ui` copy-paste patterns + `@headlessui/react` — no new component library installed as a dependency
- **Brand identity:** Storedog as outdoor/lifestyle gear brand (fits existing hat/bag/clothing catalog)

### 4.1 — Design Tokens and Typography

Update `assets/base.css` with new CSS variables. Extend `tailwind.config.js` with semantic tokens: `brand`, `brand-light`, `surface`, `surface-alt`, `border-subtle`. Add font imports. All downstream frontend features build on this foundation.

**Complexity:** S

### 4.2 — Homepage Redesign

Rebuild `pages/index.tsx` with three-zone layout:
1. Full-bleed hero with editorial image, headline, CTA button (`datadogRum.addAction('Hero CTA Clicked')`)
2. Featured Categories row (Bestsellers, New, Tops) as visual cards
3. Product marquee below the fold

Keep `<Ad />` and `<Discount />` components in place.

**Complexity:** M

### 4.3 — Product Card Hover Add-to-Cart

Add hover overlay state to `ProductCard.tsx` with "Add to Cart" button. On click: call `cartAdd` from `CartContext`, show 1.5s checkmark success state, do not navigate. Instrument as `datadogRum.addAction('Quick Add to Cart')`.

**Complexity:** M

### 4.4 — Discount Banner + Flash Sale Countdown

Replace static `Discount` component with a responsive banner consuming Phase 2.3 flash sale data. Shows countdown timer when sale is active. Dismissible via `sessionStorage`. Emits `datadogRum.addAction('Discount Banner Dismissed')` on close.

**Complexity:** M

### 4.5 — Puppeteer Selector Regression *(mandatory gate)*

After all Phase 4 features are merged: run `scripts/verify-selectors.js` against the updated app. Update `services/puppeteer/selectors-contract.json` to reflect any intentional selector changes. Verify all Puppeteer sessions complete without errors. **Phase 5 cannot begin until this gate passes.**

**Complexity:** S

---

## Phase 5 — New Microservices

> Depends on: Phase 4 complete (Puppeteer gate passed)
> **Tier 1 services** (safe tracers) run in parallel.
> **Tier 2 services** (OTEL bridge required) are conditional — add only if OTEL-based tracing is an explicit learning objective.

### Tier 1 — Native Datadog Tracer (implement all three in parallel)

#### 5.1 — Recommendations Service (Go)

Simple Go service using `net/http` (no framework). Two endpoints: `GET /recommendations?product_id=X&limit=5` (taxon-based lookup from Postgres) and `GET /health`. Frontend product page calls via `/api/recommendations/[id]`.

- **Tracer:** `gopkg.in/DataDog/dd-trace-go.v1`
- **Profiler:** `gopkg.in/DataDog/dd-trace-go.v1/profiler` (CPU + goroutine)
- **Metrics:** `recommendations.served`, `recommendations.cache_hit`, `recommendations.cache_miss` via DogStatsD
- **Logs:** Structured JSON with `dd.trace_id` injection
- **Port:** 8282 | `DD_SERVICE: store-recommendations`
- **Complexity:** M

#### 5.2 — Inventory Service (.NET 8 / C#)

ASP.NET Core minimal API. Endpoints: `GET /inventory/{variant_id}`, `POST /inventory/reserve`, `POST /inventory/release`. In-memory store backed by Postgres. Frontend product sidebar shows "Only N left!" messaging.

- **Tracer:** `Datadog.Trace` NuGet with auto-instrumentation
- **Profiler:** Datadog Continuous Profiler (`DD_PROFILING_ENABLED=true`)
- **Metrics:** `inventory.reservation.success`, `inventory.reservation.failure`, `inventory.low_stock` (gauge → monitor candidate)
- **Logs:** Serilog JSON with `dd_trace_id` + `dd_span_id`
- **Port:** 8383 | `DD_SERVICE: store-inventory`
- **Complexity:** M

#### 5.3 — Analytics Service (Kotlin / Ktor)

Ktor coroutine-first service. Endpoints: `GET /analytics/summary` (revenue today, orders today, top products, conversion rate), `GET /analytics/product/{id}/metrics`. Queries Postgres directly — complex JOINs across Spree order tables for DBM demos.

- **Tracer:** Datadog Java agent (covers Kotlin; verify routing + coroutine span coverage)
- **Metrics:** `analytics.summary.latency` (histogram), `analytics.revenue.daily` (gauge) via Micrometer + DogStatsD
- **Logs:** Log4j2 JSON with `dd.trace_id` MDC injection
- **Port:** 8686 | `DD_SERVICE: store-analytics`
- **Note:** Verify Ktor coroutine instrumentation coverage before shipping — may need manual span creation for async boundaries
- **Complexity:** M

### Tier 2 — OpenTelemetry Bridge (conditional — implement only if OTEL is an explicit lesson objective)

#### 5.4 — Notifications Service (Elixir / Phoenix)

Handles post-purchase notifications and in-app notification badges. GenServer queue backed by ETS + Postgres persistence.

- **Tracer:** `opentelemetry_exporter` Hex package → Datadog OTLP ingest endpoint
- **Note:** Native `dd-trace-elixir` support is weak — OTEL bridge is required. Explicitly document OTEL setup as a learning objective if including this service.
- **Port:** 8484 | `DD_SERVICE: store-notifications`
- **Complexity:** L

#### 5.5 — Search Service (Rust / Axum)

In-memory inverted index built from product catalog at startup. Endpoints: `GET /search?q=hat&limit=10`, `POST /index/rebuild`. Wires up the currently non-functional frontend searchbar.

- **Tracer:** `opentelemetry` crate + `opentelemetry-datadog` exporter — manual context propagation required
- **Note:** Rust has no first-class Datadog tracer. Plan for manual span creation. Zero-GC latency profile is the key observability lesson.
- **Port:** 8585 | `DD_SERVICE: store-search`
- **Complexity:** L

---

## Phase 6 — Observability Enrichment

> Depends on: Phase 5 complete
> *(Note: 6.2 trace validation moved to Phase 1.4 — run early, not here)*

### 6.1 — Error Injection on All New Services

Verify Phase 0.6 chaos pattern is implemented consistently across all Phase 5 services. Integration test: set `SERVICE_ERROR_RATE=0.5` on each service, confirm error spans appear in Datadog APM with correct `error.type`, `error.message`, `error.stack` tags.

**Complexity:** S

### 6.2 — Dashboard Seed Script

`scripts/create-dashboard.sh` using the Datadog API to create a pre-built lab dashboard with:
- Discount code usage by tier (custom metric)
- Ad click-through rate by campaign and A/B group
- Inventory reservation success/failure rate
- Recommendation cache hit rate
- Search query latency p50/p95/p99
- Analytics revenue gauge

**Complexity:** S

### 6.3 — Puppeteer Bot Extensions

New Puppeteer sessions to cover new features:
- Search bar query → click result
- Flash sale code application
- Homepage hero CTA → product page → add to cart
- Referral `?ref=` parameter on session start
- Notification badge acknowledgement

Update discount code list to include tier codes. All new sessions must pass selector contract validation.

**Complexity:** S

---

## Implementation Sequencing (Revised)

```
Phase 0 — Observability Contract (all features parallel, must fully complete first)
│
└── Phase 1 — Foundation Fixes (all parallel, depends on Phase 0)
    │
    ├── Phase 2 — Discount v2 (sequential: 2.1 → 2.2 → 2.3 → 2.4)
    │
    ├── Phase 3 — Ads Enhancement (sequential: 3.1 → 3.2 → 3.3)
    │   (Phases 2 and 3 run in parallel with each other)
    │
    └── Phase 4 — Frontend (sequential AFTER Phase 2+3 APIs are stable)
        │         (4.1 first, then 4.2 ‖ 4.3 ‖ 4.4, ends with 4.5 Puppeteer gate)
        │
        └── Phase 5 — New Services (Tier 1: Go ‖ .NET ‖ Kotlin in parallel)
                                    (Tier 2: Elixir + Rust conditional, parallel if included)
            │
            └── Phase 6 — Enrichment (after Phase 5)
```

---

## Agent Team Assignment

| Phase | Agent Strategy |
|---|---|
| Phase 0 | 5 parallel agents (one per feature 0.1–0.5; 0.6 combined with each new service) |
| Phase 1 | 4 parallel agents |
| Phase 2 | 1 agent, sequential handoff per feature |
| Phase 3 | 1 agent, sequential handoff per feature |
| Phase 4 | 1 lead agent (4.1 first), then 3 parallel sub-agents (4.2/4.3/4.4), then 4.5 |
| Phase 5 Tier 1 | 3 fully parallel agents (Go, .NET, Kotlin) |
| Phase 5 Tier 2 | 2 parallel agents (Elixir, Rust) — conditional |
| Phase 6 | 1 agent |

---

## Critical Files Reference

| File | Relevance |
|---|---|
| `services/frontend/components/checkout/CheckoutSidebarView/CheckoutSidebarView.tsx` | Phase 1.1 — discount code gap fix |
| `services/discounts/discounts.py` | Phase 2 — all discount v2 endpoints |
| `services/ads/java/src/main/java/adsjava/AdsJavaApplication.java` | Phase 3 — all ad enhancements |
| `services/frontend/assets/base.css` | Phase 4.1 — design token foundation |
| `docker-compose.yml` | Phase 5 — new service entries |
| `services/puppeteer/` | Phase 0.4 + Phase 4.5 — selector contract |
| `scripts/` | Phase 0.5, 0.6, 1.4, 6.2, 6.3 |
