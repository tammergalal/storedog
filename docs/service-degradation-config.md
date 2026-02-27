# Service Degradation Configuration

Storedog services support configurable latency and error injection via environment variables. Each service exposes its own set of variables named after the infrastructure component being simulated, enabling realistic degradation scenarios for observability labs without modifying application code.

## How It Works

- **All defaults to off.** When none of these variables are set, services behave normally with zero overhead.
- Latency and failure injection can be used independently or together.
- Setting the incident/degraded mode flag to `true` overrides both with randomised values per request:
  - Failure rate: random between 0.1 and 0.5 per request
  - Delay: random between 100ms and 2000ms per request
- Middleware runs **before** application logic so injected errors short-circuit the request.
- Health check endpoints (`/health`) are always excluded from injection.

## Per-Service Variables

### store-frontend

| Variable | Type | Default | Description |
|---|---|---|---|
| `UPSTREAM_API_FAILURE_RATE` | float `0.0`–`1.0` | `0.0` | Fraction of `/api/` requests that return 503 |
| `UPSTREAM_API_TIMEOUT_MS` | int | `0` | Artificial latency added to every `/api/` request |

**Simulates:** upstream catalog API degradation affecting server-side rendered pages.

### store-catalog

| Variable | Type | Default | Description |
|---|---|---|---|
| `CATALOG_DB_FAILOVER_RATE` | float `0.0`–`1.0` | `0.0` | Fraction of requests that fail with 503 |
| `CATALOG_IMAGE_CDN_LATENCY_MS` | int | `0` | Artificial latency added to every request |
| `CATALOG_INCIDENT_MODE` | bool | `false` | Randomises both failure rate and latency |

**Simulates:** product database failover or CDN origin degradation.

### store-cart

| Variable | Type | Default | Description |
|---|---|---|---|
| `PAYMENT_PROCESSOR_FAILURE_RATE` | float `0.0`–`1.0` | `0.0` | Fraction of requests that fail with 503 |
| `PAYMENT_GATEWAY_LATENCY_MS` | int | `0` | Artificial latency added to every request |
| `PAYMENT_DEGRADED_MODE` | bool | `false` | Randomises both failure rate and latency |

**Simulates:** payment gateway timeout or processor outage.

### store-discounts

| Variable | Type | Default | Description |
|---|---|---|---|
| `PROMO_ENGINE_OUTAGE_RATE` | float `0.0`–`1.0` | `0.0` | Fraction of requests that fail with 503 |
| `PROMO_ENGINE_RESPONSE_TIME_MS` | int | `0` | Artificial latency added to every request |
| `PROMO_ENGINE_DEGRADED` | bool | `false` | Randomises both failure rate and latency |

**Simulates:** promotion engine outage or third-party coupon service slow response.

### store-ads (Java)

| Variable | Type | Default | Description |
|---|---|---|---|
| `CAMPAIGN_FETCH_FAILURE_RATE` | float `0.0`–`1.0` | `0.0` | Fraction of requests that fail with 503 |
| `CAMPAIGN_DB_QUERY_LATENCY_MS` | int | `0` | Artificial latency added to every request |
| `CAMPAIGN_SERVICE_DEGRADED` | bool | `false` | Randomises both failure rate and latency |

**Simulates:** campaign data read replica lag or ad serving backend degradation.

### store-ads (Python, A/B variant)

| Variable | Type | Default | Description |
|---|---|---|---|
| `AD_TARGETING_FAILURE_RATE` | float `0.0`–`1.0` | `0.0` | Fraction of requests that fail with 503 |
| `AD_TARGETING_LATENCY_MS` | int | `0` | Artificial latency added to every request |
| `AD_ENGINE_INCIDENT_MODE` | bool | `false` | Randomises both failure rate and latency |

**Simulates:** ad targeting service degradation or model serving timeout.

### store-pricing-engine

| Variable | Type | Default | Description |
|---|---|---|---|
| `PRICING_RULES_FETCH_FAILURE_RATE` | float `0.0`–`1.0` | `0.0` | Fraction of requests that fail with 503 |
| `PRICING_RULES_DB_LATENCY_MS` | int | `0` | Artificial latency added to every request |
| `PRICING_ENGINE_DEGRADED` | bool | `false` | Randomises both failure rate and latency |

**Simulates:** pricing rules database read latency or rule evaluation service outage.

> Note: `PRICING_RULES_DB_LATENCY_MS` is separate from `PRICING_FETCH_DELAY_MS`, which is an intentional profiling demo feature.

## Backward Compatibility: X-Throw-Error Header

The ads services also support error injection via the `X-Throw-Error` request header. Retained for backward compatibility with Puppeteer sessions that rely on it.

- `X-Throw-Error: true` triggers an error on that specific request.
- The env-var failure rate triggers errors probabilistically across all requests.

If both are active, the header takes precedence.

## Docker Compose Example

```yaml
services:
  store-discounts:
    environment:
      - PROMO_ENGINE_OUTAGE_RATE=0.3
      - PROMO_ENGINE_RESPONSE_TIME_MS=500

  store-ads:
    environment:
      - CAMPAIGN_SERVICE_DEGRADED=true

  store-catalog:
    environment:
      - CATALOG_DB_FAILOVER_RATE=0.1
      - CATALOG_IMAGE_CDN_LATENCY_MS=200
```

### Override File Pattern

For lab scenarios, create a `docker-compose.override.yml`:

```yaml
services:
  store-discounts:
    environment:
      - PROMO_ENGINE_OUTAGE_RATE=0.5
      - PROMO_ENGINE_RESPONSE_TIME_MS=1000
  store-ads:
    environment:
      - CAMPAIGN_FETCH_FAILURE_RATE=0.3
  frontend:
    environment:
      - UPSTREAM_API_TIMEOUT_MS=300
```

Run with:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

## Datadog Value

- **Error Tracking:** Injected errors appear in APM with proper `error.type` / `error.message` / `error.stack` tags, making error tracking labs realistic.
- **Latency Analysis:** Injected delays shift p50/p95/p99 latency metrics, enabling performance investigation labs.
- **Service Map Impact:** Elevated failure rates on a service propagate downstream, creating visible degradation in the Datadog Service Map.
- **Reproducibility:** Instructors can set exact failure rates per service for consistent lab experiences across cohorts.
