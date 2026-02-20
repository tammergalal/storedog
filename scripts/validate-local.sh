#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# validate-local.sh — Local CI validation for the Storedog stack
#
# Validates docker-compose config, required env vars, service health endpoints,
# trace propagation headers, and selector contracts.
#
# Usage: ./scripts/validate-local.sh
#
# Environment:
#   DD_API_KEY       (required) Datadog API key (can be a dummy value)
#   DD_APP_KEY       (optional) Datadog App key (warns if missing)
#   APP_URL          (optional) Base URL for running app, e.g. http://localhost
# =============================================================================

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
SKIP_COUNT=0

# Detect project root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

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
# 1. Docker Compose validation
# ---------------------------------------------------------------------------
print_section "Docker Compose Validation"

if (cd "${PROJECT_ROOT}" && docker compose config > /dev/null 2>&1); then
  print_pass "docker compose config exits cleanly"
else
  print_fail "docker compose config returned non-zero exit code"
fi

# ---------------------------------------------------------------------------
# 2. Required environment variable checks
# ---------------------------------------------------------------------------
print_section "Environment Variable Checks"

# Hard requirement: DD_API_KEY
if [[ -n "${DD_API_KEY:-}" ]]; then
  print_pass "DD_API_KEY is set"
else
  print_fail "DD_API_KEY is not set (required)"
fi

# Soft requirement: DD_APP_KEY
if [[ -n "${DD_APP_KEY:-}" ]]; then
  print_pass "DD_APP_KEY is set"
else
  print_warn "DD_APP_KEY is not set (optional but recommended)"
fi

# Soft requirement: DATADOG_API_KEY (used by datadog-ci)
if [[ -n "${DATADOG_API_KEY:-}" ]]; then
  print_pass "DATADOG_API_KEY is set"
else
  print_warn "DATADOG_API_KEY is not set (needed for datadog-ci)"
fi

# Soft requirements: RUM keys
if [[ -n "${NEXT_PUBLIC_DD_APPLICATION_ID:-}" ]]; then
  print_pass "NEXT_PUBLIC_DD_APPLICATION_ID is set"
else
  print_warn "NEXT_PUBLIC_DD_APPLICATION_ID is not set (needed for RUM)"
fi

if [[ -n "${NEXT_PUBLIC_DD_CLIENT_TOKEN:-}" ]]; then
  print_pass "NEXT_PUBLIC_DD_CLIENT_TOKEN is set"
else
  print_warn "NEXT_PUBLIC_DD_CLIENT_TOKEN is not set (needed for RUM)"
fi

# ---------------------------------------------------------------------------
# 3. Health endpoint checks
# ---------------------------------------------------------------------------
print_section "Service Health Checks"

# Determine base URL: prefer APP_URL, fall back to localhost if services appear up
BASE_URL="${APP_URL:-}"
if [[ -z "${BASE_URL}" ]]; then
  # Check if anything is listening on port 80 (the service-proxy default)
  if curl -sf --max-time 2 "http://localhost/" > /dev/null 2>&1; then
    BASE_URL="http://localhost"
  fi
fi

# Service health endpoint map: name|port|path
# These ports are the INTERNAL container ports. When accessed through the
# service-proxy on port 80, we use the proxy routes instead.
declare -a SERVICES=(
  "frontend|/api/health"
  "backend|/services/backend/health"
  "discounts|/services/discounts/health"
  "ads|/services/ads/health"
)

check_health() {
  local name="$1"
  local path="$2"
  local url="${BASE_URL}${path}"

  local http_code
  local body

  # Fetch response code and body together
  if body=$(curl -sf --max-time 5 -w "\n%{http_code}" "${url}" 2>/dev/null); then
    http_code=$(printf "%s" "${body}" | tail -n1)
    body=$(printf "%s" "${body}" | sed '$d')

    if [[ "${http_code}" == "200" ]]; then
      print_pass "${name} returned HTTP 200 at ${path}"

      # Check for dd_trace_enabled in JSON body
      if printf "%s" "${body}" | grep -q "dd_trace_enabled"; then
        print_pass "${name} response includes dd_trace_enabled"
      else
        print_warn "${name} response does not include dd_trace_enabled field"
      fi
    else
      print_fail "${name} returned HTTP ${http_code} (expected 200)"
    fi
  else
    print_skip "${name} is not reachable at ${url}"
  fi
}

if [[ -n "${BASE_URL}" ]]; then
  for entry in "${SERVICES[@]}"; do
    IFS='|' read -r svc_name svc_path <<< "${entry}"
    check_health "${svc_name}" "${svc_path}"
  done
else
  print_skip "No APP_URL set and no service detected on localhost — skipping health checks"
fi

# ---------------------------------------------------------------------------
# 4. Trace propagation header check
# ---------------------------------------------------------------------------
print_section "Trace Propagation Header Check"

if [[ -n "${BASE_URL}" ]]; then
  headers=$(curl -sI --max-time 5 "${BASE_URL}/api/health" 2>/dev/null || true)

  if [[ -n "${headers}" ]]; then
    if printf "%s" "${headers}" | grep -qi "traceparent"; then
      print_pass "Response includes 'traceparent' header"
    elif printf "%s" "${headers}" | grep -qi "x-datadog-trace-id"; then
      print_pass "Response includes 'x-datadog-trace-id' header"
    else
      print_warn "No trace propagation header found (expected traceparent or x-datadog-trace-id)"
    fi
  else
    print_skip "Could not reach ${BASE_URL}/api/health for header check"
  fi
else
  print_skip "No APP_URL set — skipping trace propagation check"
fi

# ---------------------------------------------------------------------------
# 5. Selector contract check
# ---------------------------------------------------------------------------
print_section "Selector Contract Check"

SELECTOR_SCRIPT="${PROJECT_ROOT}/scripts/verify-selectors.js"

if [[ -f "${SELECTOR_SCRIPT}" ]]; then
  if [[ -n "${BASE_URL:-}" ]]; then
    if node "${SELECTOR_SCRIPT}" 2>&1; then
      print_pass "verify-selectors.js passed"
    else
      print_fail "verify-selectors.js failed"
    fi
  else
    print_skip "APP_URL not set — skipping selector verification"
  fi
else
  print_skip "scripts/verify-selectors.js not found — skipping selector check"
fi

# ---------------------------------------------------------------------------
# 6. Summary
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
