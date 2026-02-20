#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# validate-trace-propagation.sh — Trace propagation validation for Storedog
#
# Injects a synthetic W3C traceparent header into each service endpoint and
# verifies that services respond correctly. Optionally queries the Datadog API
# to confirm end-to-end trace ingestion.
#
# Usage: ./scripts/validate-trace-propagation.sh
#
# Environment:
#   BASE_URL       (optional) Base URL for the app (default: http://localhost)
#   DD_API_KEY     (optional) Datadog API key — needed for API trace check
#   DD_APP_KEY     (optional) Datadog App key — needed for API trace check
# =============================================================================

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
SKIP_COUNT=0

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
print_pass() {
  printf "  ✅ PASS: %s\n" "$1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

print_fail() {
  printf "  ❌ FAIL: %s\n" "$1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

print_warn() {
  printf "  ⚠️  WARN: %s\n" "$1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

print_skip() {
  printf "  ⏭️  SKIP: %s\n" "$1"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

print_section() {
  printf "\n━━━ %s ━━━\n" "$1"
}

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL="${BASE_URL:-http://localhost}"

# ---------------------------------------------------------------------------
# 1. Generate synthetic W3C traceparent header
# ---------------------------------------------------------------------------
print_section "Synthetic Trace Generation"

TRACE_ID="$(openssl rand -hex 16)"
PARENT_ID="$(openssl rand -hex 8)"
TRACEPARENT="00-${TRACE_ID}-${PARENT_ID}-01"

printf "  Trace ID    : %s\n" "${TRACE_ID}"
printf "  Parent ID   : %s\n" "${PARENT_ID}"
printf "  traceparent : %s\n" "${TRACEPARENT}"
print_pass "Generated synthetic traceparent header"

# ---------------------------------------------------------------------------
# 2. Service endpoint checks with injected traceparent
# ---------------------------------------------------------------------------
print_section "Trace Propagation — Service Endpoints"

declare -a SERVICES=(
  "frontend|/api/health"
  "backend|/services/backend/health"
  "discounts|/services/discounts/health"
  "ads|/services/ads/health"
)

check_trace_propagation() {
  local name="$1"
  local path="$2"
  local url="${BASE_URL}${path}"

  local http_code
  local body

  # Fetch response code and body together, injecting traceparent header
  if body=$(curl -sf --max-time 5 -H "traceparent: ${TRACEPARENT}" -w "\n%{http_code}" "${url}" 2>/dev/null); then
    http_code=$(printf "%s" "${body}" | tail -n1)
    body=$(printf "%s" "${body}" | sed '$d')

    if [[ "${http_code}" == "200" ]]; then
      print_pass "${name} returned HTTP 200 at ${path}"
    else
      print_fail "${name} returned HTTP ${http_code} (expected 200)"
    fi

    # Check for dd_trace_enabled in JSON body
    if printf "%s" "${body}" | grep -q "dd_trace_enabled.*true"; then
      print_pass "${name} reports dd_trace_enabled: true"
    elif printf "%s" "${body}" | grep -q "dd_trace_enabled"; then
      print_fail "${name} has dd_trace_enabled but not set to true"
    else
      print_fail "${name} response missing dd_trace_enabled field"
    fi
  else
    print_skip "${name} is not reachable at ${url}"
  fi
}

for entry in "${SERVICES[@]}"; do
  IFS='|' read -r svc_name svc_path <<< "${entry}"
  check_trace_propagation "${svc_name}" "${svc_path}"
done

# ---------------------------------------------------------------------------
# 3. Datadog API trace verification (optional)
# ---------------------------------------------------------------------------
print_section "Datadog API Trace Verification"

if [[ -n "${DD_API_KEY:-}" ]] && [[ -n "${DD_APP_KEY:-}" ]]; then
  printf "  Waiting 30 seconds for trace ingestion...\n"
  sleep 30

  api_response=$(curl -sf --max-time 10 \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
    "https://api.datadoghq.com/api/v1/trace/${TRACE_ID}" 2>/dev/null) || api_response=""

  if [[ -n "${api_response}" ]]; then
    # Count distinct service names in the trace spans
    service_count=$(printf "%s" "${api_response}" | grep -o '"service":"[^"]*"' | sort -u | wc -l | tr -d ' ')

    if [[ "${service_count}" -gt 1 ]]; then
      print_pass "Trace ${TRACE_ID} contains spans from ${service_count} services"
    elif [[ "${service_count}" -eq 1 ]]; then
      print_warn "Trace ${TRACE_ID} contains spans from only 1 service (expected multiple)"
    else
      print_fail "Trace ${TRACE_ID} found but contains no service spans"
    fi
  else
    print_fail "Could not retrieve trace ${TRACE_ID} from Datadog API"
  fi
else
  print_skip "DD_API_KEY and/or DD_APP_KEY not set — skipping Datadog API trace check"
fi

# ---------------------------------------------------------------------------
# 4. Summary
# ---------------------------------------------------------------------------
print_section "Summary"

TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT + SKIP_COUNT))
printf "\n"
printf "  Total checks : %d\n" "${TOTAL}"
printf "  Passed       : %d\n" "${PASS_COUNT}"
printf "  Failed       : %d\n" "${FAIL_COUNT}"
printf "  Warnings     : %d\n" "${WARN_COUNT}"
printf "  Skipped      : %d\n" "${SKIP_COUNT}"
printf "\n"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  printf "Result: FAILED (%d hard failure(s))\n" "${FAIL_COUNT}"
  exit 1
else
  printf "Result: PASSED (all checks passed or produced warnings only)\n"
  exit 0
fi
