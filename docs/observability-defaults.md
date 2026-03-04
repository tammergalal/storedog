# Observability Defaults

Standard observability configuration for all Storedog services. Every service must follow these defaults to ensure consistent APM, logging, and tracing behavior.

## Unified Service Tagging

All services use the three core Datadog tags: `DD_SERVICE`, `DD_ENV`, and `DD_VERSION`.

| Service | `DD_SERVICE` | `DD_ENV` | `DD_VERSION` | Language | Tracer |
|---|---|---|---|---|---|
| Frontend | `store-frontend-api` (API routes) / `store-frontend` (RUM) | `${DD_ENV:-production}` | `${NEXT_PUBLIC_DD_VERSION_FRONTEND:-1.0.0}` | Node.js | dd-trace-js |
| Backend | `store-backend` | `${DD_ENV:-production}` | `${DD_VERSION_BACKEND:-1.0.0}` | Ruby | ddtrace (gem) |
| Worker | `store-worker` | `${DD_ENV:-production}` | `${DD_VERSION_BACKEND:-1.0.0}` | Ruby | ddtrace (gem) |
| Discounts | `store-discounts` | `${DD_ENV:-production}` | `${DD_VERSION_DISCOUNTS:-1.0.0}` | Python | ddtrace |
| Ads | `store-ads` | `${DD_ENV:-production}` | `${DD_VERSION_ADS:-1.0.0}` | Java | dd-java-agent |
| Service Proxy | `service-proxy` | `${DD_ENV:-production}` | `${DD_VERSION_NGINX:-1.28.0}` | N/A | Nginx module |
| Postgres | `store-db` (via label) | `${DD_ENV:-production}` | `${DD_VERSION_POSTGRES:-15.0}` | N/A | Agent check |
| Redis | `redis` (via label) | `${DD_ENV:-production}` | `${DD_VERSION_REDIS:-6.2}` | N/A | Agent check |

### Notes

- `DD_ENV` defaults to `production` across all services when not set.
- The frontend has two service names: `store-frontend-api` for server-side Next.js API routes (set via `DD_SERVICE`) and `store-frontend` for client-side RUM (set via `NEXT_PUBLIC_DD_SERVICE_FRONTEND`).
- Version variables are service-specific (e.g., `DD_VERSION_BACKEND`, `DD_VERSION_DISCOUNTS`) to allow independent versioning.

## JSON Log Schema

All services must emit structured JSON logs matching this schema:

```json
{
  "timestamp": "ISO8601",
  "level": "info|warn|error",
  "message": "Human-readable log message",
  "service": "<DD_SERVICE value>",
  "env": "<DD_ENV value>",
  "version": "<DD_VERSION value>",
  "dd.trace_id": "<64-bit trace id>",
  "dd.span_id": "<64-bit span id>"
}
```

### Per-Language Implementation

| Service | Logger | Correlation Method |
|---|---|---|
| Frontend (Node.js) | `next-logger` | dd-trace automatic log injection |
| Backend (Ruby) | `lograge` + `lograge_sql` | ddtrace correlation via `Datadog::Tracing.correlation` |
| Worker (Ruby) | `lograge` | ddtrace correlation via `Datadog::Tracing.correlation` |
| Discounts (Python) | Named app logger + `json_log_formatter` | ddtrace patch for log correlation (`DD_LOGS_INJECTION=true`) |
| Ads (Java) | Logback + Logstash encoder | dd-java-agent MDC injection (`dd.trace_id`, `dd.span_id`) |

### Key Rules

- Python services must use a named application logger (e.g., `logging.getLogger('discounts')`), not the default `werkzeug` logger.
- Ruby services must include `dd.trace_id` and `dd.span_id` in lograge custom options.
- Java services must verify that the Logstash encoder includes MDC fields `dd.trace_id` and `dd.span_id`.

## Trace Propagation Style

- **Primary:** W3C TraceContext (`traceparent` / `tracestate` headers)
- **Secondary:** Datadog headers (`x-datadog-trace-id`, `x-datadog-parent-id`, `x-datadog-sampling-priority`)

All services must accept both formats. Configure via:

| Language | Config |
|---|---|
| Node.js | `DD_TRACE_PROPAGATION_STYLE=tracecontext,datadog` |
| Ruby | `DD_TRACE_PROPAGATION_STYLE=tracecontext,datadog` |
| Python | `DD_TRACE_PROPAGATION_STYLE=tracecontext,datadog` |
| Java | `-Ddd.trace.propagation.style=tracecontext,datadog` (or env var `DD_TRACE_PROPAGATION_STYLE`) |

## Health Endpoint Contract

Every service must expose `GET /health` returning:

```json
{
  "service": "<DD_SERVICE value>",
  "version": "<DD_VERSION value>",
  "dd_trace_enabled": true,
  "db_connected": true
}
```

- HTTP 200 when healthy, HTTP 503 when degraded.
- `db_connected` should reflect actual database connectivity (set to `true` if the service does not use a database).
- `dd_trace_enabled` should reflect whether the tracer is loaded and active.

## Service Degradation Environment Variables

See [service-degradation-config.md](./service-degradation-config.md) for full details. Each service has its own set of variables named after the infrastructure component being simulated. All default to off (zero impact when not set).

## Sampling Configuration

| Setting | Value | Notes |
|---|---|---|
| Default sample rate | `1.0` (100%) | Demo environment -- capture all traces |
| `DD_TRACE_SAMPLE_RATE` | `1.0` | Set on all services for consistent capture |
| Agent-level sampling | Not configured | Rely on tracer-level sampling |

In production-like lab scenarios, instructors may lower sampling rates to demonstrate sampling behavior.

## Tracer Versions

Target tracer versions for consistent behavior across the stack:

| Language | Tracer Package | Minimum Version |
|---|---|---|
| Node.js | `dd-trace` | `>=4.0.0` |
| Ruby | `datadog` (gem) | `>=2.0.0` |
| Python | `ddtrace` | `>=2.0.0` |
| Java | `dd-java-agent` | `>=1.20.0` |
| Go (future) | `dd-trace-go` | `>=1.60.0` |
| .NET (future) | `Datadog.Trace` | `>=2.40.0` |

### Runtime Profiling

All existing services have profiling enabled:

```yaml
DD_PROFILING_ENABLED: true
DD_PROFILING_TIMELINE_ENABLED: true
DD_PROFILING_ALLOCATION_ENABLED: true
```

The backend and worker use `ddprofrb exec` to enable the Ruby profiler. Runtime metrics are enabled on frontend, backend, worker, and discounts via `DD_RUNTIME_METRICS_ENABLED=true`.
