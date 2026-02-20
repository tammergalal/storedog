# Trace Propagation Standard

## Overview

All Storedog services use **dual-format trace propagation**: W3C TraceContext as the primary format, with Datadog-native headers as a secondary fallback.

## Propagation Formats

### Primary: W3C TraceContext

- Header: `traceparent`
- Format: `00-<trace-id>-<parent-id>-<trace-flags>`
- Trace ID is 128-bit (32 hex characters)

### Secondary: Datadog Headers

- `x-datadog-trace-id` (64-bit integer)
- `x-datadog-parent-id` (64-bit integer)
- `x-datadog-sampling-priority`

## Lower 64-Bit Mapping Rule

When both propagation styles are configured, dd-trace libraries automatically handle the mapping between W3C 128-bit trace IDs and Datadog 64-bit trace IDs. The lower 64 bits of the W3C `traceparent` trace ID correspond to the Datadog `x-datadog-trace-id` value. This mapping is handled transparently by the tracer when both styles are enabled.

## Header Precedence

When both `traceparent` and `x-datadog-trace-id` headers are present on an inbound request, W3C TraceContext takes priority. The Datadog headers are used only when `traceparent` is absent.

Extraction order: `['tracecontext', 'datadog']`
Injection order: `['tracecontext', 'datadog']`

## Per-Service Configuration

| Service          | Language | Configuration Method                                      |
|------------------|----------|------------------------------------------------------------|
| frontend         | Node.js  | `propagation` option in `datadog-tracer.js`                |
| backend / worker | Ruby     | `c.tracing.propagation_style` in `datadog-tracer.rb`      |
| discounts        | Python   | `DD_TRACE_PROPAGATION_STYLE` env var in docker-compose.yml |
| ads (Java)       | Java     | `DD_TRACE_PROPAGATION_STYLE` env var in docker-compose.yml |

## Canonical Session ID

RUM (Real User Monitoring) generates a session ID on the client side. The frontend service passes this value downstream as the `X-Session-Id` HTTP header on all API calls to the backend. Backend and downstream services read and log this header to correlate server-side traces with client-side RUM sessions.

This session ID is used for A/B bucketing in Phase 3.2, where services can use the `X-Session-Id` value to deterministically assign users to experiment cohorts.
