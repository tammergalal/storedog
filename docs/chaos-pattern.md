# Chaos Pattern

Standardized error and latency injection for all Storedog services. Implemented as middleware (or decorator/filter) in each language, controlled entirely via environment variables.

## Environment Variables

| Variable | Type | Range | Default | Description |
|---|---|---|---|---|
| `SERVICE_ERROR_RATE` | float | `0.0` -- `1.0` | `0.0` | Probability of returning an HTTP 500 error on any request. `0.0` = no errors, `1.0` = every request fails. |
| `SERVICE_DELAY_MS` | int | `0` -- any | `0` | Artificial latency in milliseconds added to every request before processing. `0` = no delay. |
| `SERVICE_CHAOS_MODE` | bool | `true` / `false` | `false` | When `true`, enables a random mix of both errors and delays. Overrides `SERVICE_ERROR_RATE` and `SERVICE_DELAY_MS` with randomized values per request. |

### Behavior

- **All default to off.** When none of these variables are set, services behave normally with zero overhead.
- `SERVICE_ERROR_RATE` and `SERVICE_DELAY_MS` can be used independently or together.
- `SERVICE_CHAOS_MODE=true` overrides the other two with randomized values:
  - Error rate: random between 0.1 and 0.5 per request batch
  - Delay: random between 100ms and 2000ms per request
- The middleware must run **before** application logic so that injected errors short-circuit the request.
- Error responses must include `error.type`, `error.message`, and `error.stack` span tags for Datadog APM visibility.

## Implementation Per Language

Each service implements chaos as a middleware/decorator that:

1. Reads the three env vars at startup (not per-request, for performance).
2. On each incoming request:
   - If `SERVICE_CHAOS_MODE` is true, generate random error rate and delay values.
   - If delay > 0, sleep for the configured duration.
   - If error rate > 0, generate a random float; if below the threshold, return HTTP 500 with a JSON error body.
3. If no chaos is triggered, pass through to the normal request handler.

### Error Response Shape

When chaos triggers an error, return:

```json
{
  "error": "Injected chaos error",
  "service": "<DD_SERVICE>",
  "chaos_mode": true
}
```

HTTP status: `500 Internal Server Error`

## Backward Compatibility: X-Throw-Error Header

The existing ads services (both Java and Python variants) currently support error injection via the `X-Throw-Error` request header. This header-based mechanism is **retained** for backward compatibility with existing Puppeteer sessions and lab scripts that rely on it.

The new env-var-based chaos pattern is **additive** -- it does not replace the header-based approach. Both mechanisms can coexist:

- `X-Throw-Error: true` triggers an error on that specific request (targeted injection).
- `SERVICE_ERROR_RATE` triggers errors probabilistically across all requests (ambient injection).

If both are active, the header takes precedence (the request will always error if the header is present, regardless of the random error rate roll).

## Docker Compose Example

Enable chaos on specific services by adding environment variables:

```yaml
services:
  discounts:
    environment:
      # ... existing env vars ...
      - SERVICE_ERROR_RATE=0.3        # 30% of requests return 500
      - SERVICE_DELAY_MS=500          # 500ms added latency on every request

  ads:
    environment:
      # ... existing env vars ...
      - SERVICE_CHAOS_MODE=true       # random errors + delays

  backend:
    environment:
      # ... existing env vars ...
      - SERVICE_ERROR_RATE=0.1        # 10% error rate
      - SERVICE_DELAY_MS=200          # 200ms added latency
```

### Override File Pattern

For lab scenarios, create a `docker-compose.chaos.yml` override:

```yaml
# docker-compose.chaos.yml
services:
  discounts:
    environment:
      - SERVICE_ERROR_RATE=0.5
      - SERVICE_DELAY_MS=1000
  ads:
    environment:
      - SERVICE_ERROR_RATE=0.3
  frontend:
    environment:
      - SERVICE_DELAY_MS=300
```

Run with:

```bash
docker compose -f docker-compose.yml -f docker-compose.chaos.yml up
```

This keeps the base `docker-compose.yml` clean and allows instructors to toggle chaos scenarios per lab without editing the main configuration.

## Datadog Value

- **Error Tracking:** Injected errors appear in APM with proper `error.type` / `error.message` / `error.stack` tags, making error tracking labs realistic.
- **Latency Analysis:** Injected delays shift p50/p95/p99 latency metrics, enabling performance investigation labs.
- **Service Map Impact:** Elevated error rates on a service propagate downstream, creating visible degradation in the Datadog Service Map.
- **Reproducibility:** Instructors can set exact error rates per service for consistent lab experiences across cohorts.
