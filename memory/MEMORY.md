# Storedog Project Memory

## Project Overview
Storedog is a Datadog demo/lab application (fictional outdoor/athletic gear store) used in Instruqt courses to demonstrate APM, RUM, log management, and security features.

**Repo:** `~/projects/forks/storedog`
**Branch:** `main`

---

## Architecture (current state)

```
Browser
  ↓
nginx (service-proxy:80)
  ├── /services/frontend  →  store-frontend:3000  (Remix v2 / Vite)
  ├── /services/catalog   →  store-catalog:8000   (FastAPI / Python)
  ├── /services/cart      →  store-cart:8001      (FastAPI / Python)
  ├── /services/discounts →  store-discounts:2814 (Flask / Python)
  └── /services/ads       →  store-ads:8080       (Java + Python)

store-cart → store-catalog  (get variant data on add_item)
store-cart → store-discounts (coupon validation)

Postgres: schema=catalog (products, variants, taxons, images, pages)
          schema=cart    (orders, line_items)
Redis: used by store-discounts for rate limiting (keep it)
```

### Key decisions
- **Spree Rails monolith removed** — replaced with store-catalog + store-cart FastAPI services
- **Flat JSON responses** (not JSON:API) — no more `data.attributes` parsing
- **`X-Spree-Order-Token` header kept** — frontend sends this everywhere, do not rename
- **Redis kept** — discounts service uses it for rate limiting
- **No backend/worker containers** — removed entirely

---

## Service Summary

### `services/catalog/` — FastAPI, port 8000
- Endpoints: `/products`, `/products/:slug`, `/taxons`, `/taxons/:id`, `/taxons/by-permalink/:permalink`, `/cms_pages`, `/cms_pages/:slug`, `/health`
- DB schema: `catalog` (6 tables)
- Seeds 12 products + taxons + pages at startup from `seed_data/*.json`
- DD service name: `store-catalog`

### `services/cart/` — FastAPI, port 8001
- Full cart + checkout state machine (cart→address→delivery→payment→complete)
- Auth via `X-Spree-Order-Token` header
- Calls catalog on `add_item` (snapshots name/price/slug/image into line_items)
- Calls discounts for coupon validation
- DD service name: `store-cart`
- Key file: `cart_utils.py` — shared `recalculate_order()` and `order_to_dict()`

### `services/frontend/` — Remix v2 (Vite), port 3000
- **Migrated from Next.js 12** — `pages/` directory deleted, uses `app/routes/`
- API client: `lib/apiClient.ts` — `catalogRequest()` + `cartRequest()`
- Env vars: `CATALOG_API_HOST`, `CART_API_HOST` (replaces old SPREE vars)
- DD RUM injected via `window.ENV` in root loader → `entry.client.tsx`
- Infrastructure degradation middleware in `entry.server.tsx` (UPSTREAM_API_FAILURE_RATE, UPSTREAM_API_TIMEOUT_MS)

### `services/discounts/` — Flask, port 2814 (unchanged)
- Redis rate limiting, discount code validation
- Old Flask 1.x / SQLAlchemy 1.3 — intentionally outdated for CVE demo
- `db.drop_all()` on every restart — intentional for demo reproducibility
- SSH backdoor user `test:test` — intentional for ASM/security lab scenarios

### `services/ads/` — Java (Spring Boot) + Python (Flask) (unchanged)

---

## Frontend Key Files
- `app/root.tsx` — HTML shell, DD env injection, CartProvider, ManagedUIContext
- `app/entry.client.tsx` — DD RUM init with `window.ENV`
- `app/entry.server.tsx` — infrastructure degradation middleware + SSR handler
- `app/styles/` — Tailwind CSS (must be here, not `public/`, for PostCSS processing)
- `lib/apiClient.ts` — catalog + cart HTTP clients
- `lib/CartContext.tsx` — cart state, token stored in localStorage
- `lib/api/products.ts`, `taxons.ts`, `pages.ts`, `cart.ts`, `checkout.ts`
- `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`

---

## Known Remaining Issues (not yet fixed)
1. `products.$slug.tsx:9-13` — 7.5s random delay fires for any referer with `/search` in URL; not gated by feature flag
2. Cart resource routes (`api.cart.add.ts` etc.) are orphaned — CartContext calls cart API directly from browser, these server-side proxy routes are never invoked
3. `getTaxons()` returns `Record<string, Taxon>` but recursive render uses it as array — works via duck-typing but type-unsafe

---

## Infrastructure
- `docker-compose.yml` — production
- `docker-compose.dev.yml` — dev (adds `--reload`, volume mounts)
- `services/nginx/default.conf.template` — proxy routing
- `services/nginx/status.conf` — nginx status endpoint (ACL fixed: deny all by default)
- Frontend Dockerfile — multi-stage build (build at image build time, not container start)
- Both new service Dockerfiles — non-root `appuser`, HEALTHCHECK, `ddtrace-run uvicorn main:app`

---

## Datadog Instrumentation Patterns
- Python services: `ddtrace-run uvicorn main:app ...` in Dockerfile CMD
- `bootstrap.py` sets `config.service`, `config.env`, `config.version` — no `tracer.configure()` (deprecated)
- `patch_all()` NOT called manually — `ddtrace-run` does it automatically
- Trace propagation: `DD_TRACE_PROPAGATION_STYLE=tracecontext,datadog` on all services
- Cart checkout complete: manual span tags `order.id`, `cart.total`, `cart.item_count`
- Catalog product list: manual span tags `catalog.filter.taxon`, `catalog.result.count`
- RUM: `window.ENV` injected in root loader, initialized in `entry.client.tsx`

---

## Important Patterns / Gotchas
- **`db.flush()` before `recalculate_order()`** — always flush after add/delete so the recalc query sees the change
- **`selectinload` not `joinedload`** — joinedload + limit() causes wrong pagination in SQLAlchemy
- **`with_for_update()`** on existing line item query in `add_item` — prevents race condition
- **`SessionLocal()` directly in lifespan** — don't use `next(get_db())` (generator leak)
- **CSS must be in `app/styles/`** — not `public/` — for Vite/PostCSS to process Tailwind
- **`X-Spree-Order-Token`** header name — do not rename, used in 10+ places
- **Money columns** — always `NUMERIC(10,2)`, never `FLOAT`; use `round(float(x), 2)` in Python serialization

---

## Work History
- Migrated frontend: Next.js 12 → Remix v2 (Vite-based)
- Replaced Spree Rails backend with store-catalog + store-cart FastAPI services
- Comprehensive code review across all 4 services + infra
- Applied all critical + high + suggestion fixes via agent teams
